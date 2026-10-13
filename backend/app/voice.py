"""Voice commands: one spoken sentence in, one ledger action out.

The listening and the talking happen in the browser's own speech engine; this module
only understands the transcript. Keeping the parsing here means the agent's spoken reply
is decided in one place, and can be tested without a microphone.
"""

from __future__ import annotations

import re

SCAN_WORDS = (
    "scan",
    "search",
    "look for",
    "find work",
    "find bounties",
    "hunt for",
    "any new work",
    "check for work",
    "whats out there",
    "what's out there",
)

INCOME_WORDS = (
    "received",
    "receive",
    "earned",
    "i earn",
    "income",
    "got paid",
    "paid me",
    "payout",
    "came in",
    "money in",
    "i got",
    "made",
    "refund",
)

EXPENSE_WORDS = (
    "spent",
    "spend",
    "paid",
    "cost",
    "bought",
    "buy",
    "charge",
    "charged",
    "expense",
    "money out",
    "out of pocket",
)

CONFIRMED_WORDS = ("confirmed", "cleared", "already paid", "landed", "banked")

EXPENSE_CATEGORIES = {
    "séance": "Séance",
    "seance": "Séance",
    "exorcism": "Exorcism",
    "exorcist": "Exorcism",
    "relic": "Cursed Relics",
    "cursed": "Cursed Relics",
    "ectoplasm": "Ectoplasm",
    "ghost tour": "Ghost Tours",
    "tour": "Ghost Tours",
    "salt": "Salt & Iron",
    "iron": "Salt & Iron",
    "chalk": "Salt & Iron",
}

INCOME_CATEGORIES = {
    "bounty": "Bounty",
    "freelance": "Freelance",
    "gig": "Freelance",
    "contract": "Freelance",
    "affiliate": "Affiliate",
    "referral": "Referral",
    "royalt": "Royalty",
}

PAYOUT_METHODS = {
    "bitcoin": "Bitcoin",
    "btc": "Bitcoin",
    "sats": "Bitcoin",
    "paypal": "PayPal",
    "crypto": "Crypto",
    "token": "Crypto",
    "usdc": "Crypto",
    "bank": "Bank transfer",
    "wire": "Bank transfer",
    "transfer": "Bank transfer",
}

FILLER = {
    "i", "a", "an", "the", "on", "for", "to", "of", "my", "me", "at", "from", "in",
    "with", "and", "it", "that", "this", "was", "is", "just", "about", "around",
    "dollars", "dollar", "usd", "bucks", "buck", "euro", "euros", "cash", "worth",
    "spent", "spend", "paid", "pay", "cost", "costs", "bought", "buy", "charge",
    "charged", "expense", "received", "receive", "earned", "earn", "income", "made",
    "make", "got", "get", "money", "out", "payout", "please", "log", "logged",
    "record", "recorded", "add", "note", "down", "new", "also", "now",
    "confirmed", "cleared", "pending", "banked", "landed", "via", "by",
    "bitcoin", "btc", "paypal", "crypto", "token", "usdc", "sats", "bank",
    "wire", "transfer",
}

NUMBER = re.compile(r"(?<![\w.])(\d[\d.,]*)(?![\w])")


def _amount(text: str) -> float | None:
    match = NUMBER.search(text)
    if not match:
        return None
    raw = match.group(1).rstrip(".,")
    if re.search(r",\d{3}(?:,|$)", raw):
        raw = raw.replace(",", "")
    try:
        value = float(raw.replace(",", "."))
    except ValueError:
        return None
    return value if value > 0 else None


def _pick(text: str, words: dict[str, str], default: str) -> str:
    for word, name in words.items():
        if word in text:
            return name
    return default


def _subject(text: str) -> str:
    kept = []
    for word in text.split():
        bare = word.strip(".,!?;:\"'").lower()
        if not bare or bare in FILLER or re.fullmatch(r"\$?\d[\d.,]*", bare):
            continue
        kept.append(word.strip(".,!?;:\"'"))
    return " ".join(kept)[:200]


def _money(amount: float) -> str:
    return f"{amount:g} dollars"


def _unknown(reply: str) -> dict:
    return {"intent": "unknown", "reply": reply, "payload": None}


def _entry(intent: str, text: str, lowered: str, amount: float) -> dict:
    subject = _subject(text)
    if intent == "expense":
        payload = {
            "description": subject or "Spoken charge",
            "category": _pick(lowered, EXPENSE_CATEGORIES, "Other"),
            "amount": amount,
        }
        reply = f"Logged {_money(amount)} for {payload['description']}."
    else:
        status = (
            "confirmed"
            if any(word in lowered for word in CONFIRMED_WORDS)
            else "pending"
        )
        payload = {
            "description": subject or "Spoken income",
            "source": "",
            "category": _pick(lowered, INCOME_CATEGORIES, "Other"),
            "amount": amount,
            "payout_method": _pick(lowered, PAYOUT_METHODS, "Other"),
            "status": status,
        }
        reply = f"Logged {_money(amount)} in from {payload['description']}, {status}."
    return {"intent": intent, "reply": reply, "payload": payload}


def interpret(phrase: str) -> dict:
    """Turn one spoken sentence into `{intent, reply, payload}`.

    Intents: `expense`, `income`, `scan` (the scout sweeps the boards) or `unknown`
    (the reply says what to try instead). Amounts are spoken as digits.
    """
    text = " ".join((phrase or "").split())
    if not text:
        return _unknown("I did not catch that — say it again a little slower.")

    lowered = text.lower()
    amount = _amount(lowered)

    if any(word in lowered for word in SCAN_WORDS):
        return {
            "intent": "scan",
            "reply": "Sweeping the boards now — I will say what I find.",
            "payload": None,
        }

    for words, intent in ((INCOME_WORDS, "income"), (EXPENSE_WORDS, "expense")):
        if not any(word in lowered for word in words):
            continue
        if amount is None:
            example = (
                "received 300 for a bounty"
                if intent == "income"
                else "spent 25 on salt"
            )
            return _unknown(f"I heard the words but not an amount. Try: {example}.")
        return _entry(intent, text, lowered, amount)

    return _unknown(
        "I can log a charge, log money coming in, or run a scan. "
        "Try: spent 25 on salt, or received 300 for a bounty."
    )
