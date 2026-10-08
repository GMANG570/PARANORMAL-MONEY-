"""Scout agent: reads public listings and records paid opportunities.

Read-only by design. The agent fetches public feeds and search results, works out
how each listing pays (Bitcoin / PayPal / other crypto) and stores what is new for
you to review. It never registers, applies, signs up or logs in anywhere on your
behalf — you take it from the shortlist yourself.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from datetime import datetime, timezone
from urllib.parse import quote
from urllib.request import Request, urlopen

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .db import SessionLocal

log = logging.getLogger("paranormal.agent")

USER_AGENT = "ParanormalMoneyScout/1.0 (personal ledger; read-only discovery)"
REQUEST_TIMEOUT = 25
MAX_NEW_PER_SCAN = 120
DEFAULT_INTERVAL_SECONDS = 21600  # six hours

BITCOIN = re.compile(r"\b(bitcoin|btc|sats|satoshis|lightning network)\b", re.I)
PAYPAL = re.compile(r"\bpaypal\b", re.I)
CRYPTO = re.compile(
    r"\b(usdc|usdt|stablecoin|crypto|ethereum|solana|matic|altcoin|token reward)\b", re.I
)
# Rewards quoted as an amount of coin, e.g. "1 RTC", "0.5 SOL", "250 sats".
TOKEN_REWARD = re.compile(
    r"\b\d[\d,]*(?:\.\d+)?\s?"
    r"(?:btc|sats|eth|sol|usdc|usdt|avax|matic|dot|ada|xrp|arb|op|near|sui|apt|sei|tia|"
    r"bnb|ltc|doge|atom|inj|kas|rtc)\b",
    re.I,
)
RELEVANT = re.compile(
    r"\b(bounty|bounties|freelance|contract|gig|affiliate|referral|reward|"
    r"web3|crypto|bitcoin|paypal|paid)\b",
    re.I,
)
MONEY = re.compile(
    r"(?:[$€£]\s?\d[\d,]*(?:\.\d+)?"
    r"|\d[\d,]*(?:\.\d+)?\s?[$€£]"
    r"|\b\d[\d,]*\s?(?:usd|usdc|usdt|sats|btc|eur)\b)",
    re.I,
)
TAGS = re.compile(r"<[^>]+>")
NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")
# "no PayPal", "without crypto", "instead of BTC" — a mention that rules the method out.
NEGATED = re.compile(r"\b(no|not|without|instead of|rather than|don't|do not)\b[^.]{0,24}$", re.I)

STATUS: dict = {
    "interval_seconds": None,
    "last_run": None,
    "last_report": None,
    "last_error": None,
}


def _fetch(url: str) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json, text/plain, */*",
        },
    )
    with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        return response.read().decode("utf-8", "replace")


def _plain(value) -> str:
    return TAGS.sub(" ", str(value or ""))


def _payout(text: str) -> tuple[str, str | None]:
    patterns = (
        ("Bitcoin", BITCOIN),
        ("PayPal", PAYPAL),
        ("Crypto", CRYPTO),
        ("Crypto", TOKEN_REWARD),
    )
    for method, pattern in patterns:
        for match in pattern.finditer(text):
            lead = text[max(match.start() - 34, 0) : match.start()]
            if NEGATED.search(lead):
                continue  # e.g. "No Stripe/PayPal needed"
            snippet = text[max(match.start() - 60, 0) : match.end() + 60].strip()
            return method, " ".join(snippet.split())[:200]
    return "Unknown", None


def _budget(text: str) -> str | None:
    match = MONEY.search(text)
    return match.group(0)[:120] if match else None


def _salary(low, high) -> str | None:
    low = low or 0
    high = high or 0
    if not low and not high:
        return None
    if low and high and low != high:
        return f"${low:,.0f} – ${high:,.0f}"
    return f"${(low or high):,.0f}"


def _amount(text: str | None) -> float | None:
    if not text:
        return None
    match = NUMBER.search(text)
    if not match:
        return None
    try:
        return float(match.group(0).replace(",", ""))
    except ValueError:
        return None


def _floor(salary: str | None, text: str) -> float | None:
    """Lowest amount a listing says it pays — what you review against.

    Quoted salaries win; otherwise the first money amount in the body. Listings
    whose reward is coin-only ("1 RTC") have no floor we can price.
    """
    if salary:
        parts = [_amount(part) for part in salary.replace("–", "-").split("-")]
        values = [value for value in parts if value]
        if values:
            return min(values)
    money = MONEY.search(text)
    return _amount(money.group(0)) if money else None


def _remoteok() -> list[dict]:
    listings = []
    for item in json.loads(_fetch("https://remoteok.com/api")):
        if not isinstance(item, dict) or not item.get("position"):
            continue
        listings.append(
            {
                "title": f"{item['position'].strip()} — {str(item.get('company', '')).strip()}",
                "url": item.get("url") or item.get("apply_url"),
                "source": "RemoteOK",
                "kind": "gig",
                "text": f"{_plain(item.get('description'))} {' '.join(item.get('tags') or [])}",
                "salary": _salary(item.get("salary_min"), item.get("salary_max")),
            }
        )
    return listings


def _arbeitnow() -> list[dict]:
    listings = []
    for item in json.loads(_fetch("https://arbeitnow.com/api/job-board-api")).get("data", []):
        listings.append(
            {
                "title": f"{str(item.get('title', '')).strip()} — {str(item.get('company_name', '')).strip()}",
                "url": item.get("url"),
                "source": "Arbeitnow",
                "kind": "gig",
                "text": f"{_plain(item.get('description'))} {' '.join(item.get('tags') or [])}",
                "salary": None,
            }
        )
    return listings


def _github_bounties() -> list[dict]:
    url = (
        "https://api.github.com/search/issues?q="
        f"{quote('label:\"bounty\" state:open')}&sort=updated&per_page=50"
    )
    payload = json.loads(_fetch(url))
    listings = []
    for item in payload.get("items", []):
        labels = " ".join(label.get("name", "") for label in item.get("labels") or [])
        listings.append(
            {
                "title": str(item.get("title", "")).strip(),
                "url": item.get("html_url"),
                "source": "GitHub bounties",
                "kind": "bounty",
                "text": f"{_plain(item.get('body'))} {labels}",
                "salary": None,
            }
        )
    return listings


SOURCES = (
    ("RemoteOK", _remoteok),
    ("Arbeitnow", _arbeitnow),
    ("GitHub bounties", _github_bounties),
)


def _worthy(listing: dict) -> bool:
    if listing.get("kind") == "bounty":
        return True
    return bool(RELEVANT.search(f"{listing.get('title', '')} {listing.get('text', '')}"))


def scan(db: Session) -> dict:
    """Walk every source once and store opportunities that are new to us."""
    report = {
        "checked": 0,
        "added": 0,
        "refreshed": 0,
        "skipped": 0,
        "sources": {},
        "errors": [],
    }

    for name, loader in SOURCES:
        try:
            listings = loader()
        except Exception as exc:  # one dead source must not sink the scan
            log.warning("source %s failed: %s", name, exc)
            report["errors"].append(f"{name}: {exc}")
            continue

        added = 0
        for listing in listings:
            report["checked"] += 1
            if report["added"] >= MAX_NEW_PER_SCAN:
                break

            url = str(listing.get("url") or "").strip()
            if not url or not _worthy(listing):
                report["skipped"] += 1
                continue
            text = f"{listing.get('title', '')} {listing.get('text', '')}"
            payout_method, payout_text = _payout(text)
            title = str(listing["title"])[:300]
            budget = listing.get("salary") or _budget(text)
            floor = _floor(listing.get("salary"), text)

            known = db.scalar(
                select(models.Opportunity).where(models.Opportunity.url == url)
            )
            if known:
                # Re-read listings we already have, so better detection reaches them.
                if (
                    known.payout_method,
                    known.budget_text,
                    known.title,
                    known.payout_floor,
                ) != (payout_method, budget, title, floor):
                    known.title = title
                    known.payout_method = payout_method
                    known.payout_text = payout_text
                    known.budget_text = budget
                    known.payout_floor = floor
                    report["refreshed"] += 1
                else:
                    report["skipped"] += 1
                continue

            db.add(
                models.Opportunity(
                    title=title,
                    url=url[:600],
                    source=str(listing["source"])[:120],
                    kind=str(listing["kind"])[:40],
                    payout_method=payout_method,
                    payout_text=payout_text,
                    budget_text=budget,
                    payout_floor=floor,
                )
            )
            report["added"] += 1
            added += 1

        report["sources"][name] = added

    db.commit()
    return report


def run_scan() -> dict:
    """Scan once and remember the outcome. Used by both the API and the loop."""
    with SessionLocal() as db:
        report = scan(db)
    STATUS["last_run"] = datetime.now(timezone.utc)
    STATUS["last_report"] = report
    STATUS["last_error"] = report["errors"][0] if report["errors"] else None
    return report


def interval_seconds() -> int:
    return int(os.environ.get("AGENT_SCAN_INTERVAL_SECONDS", str(DEFAULT_INTERVAL_SECONDS)))


async def run_forever(interval: int, first_delay: float = 15.0) -> None:
    """Keep scanning for as long as the API process lives."""
    STATUS["interval_seconds"] = interval
    await asyncio.sleep(first_delay)
    while True:
        try:
            await asyncio.to_thread(run_scan)
        except Exception as exc:
            log.warning("scheduled scan failed: %s", exc)
            STATUS["last_error"] = str(exc)
        await asyncio.sleep(interval)
