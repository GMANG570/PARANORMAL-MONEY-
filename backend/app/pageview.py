"""Screen view: what a listing page shows, and everything clickable on it.

Read-only, like the rest of the scout. The agent fetches a public page, reports the
text and the controls it finds (links, buttons, icons) and can follow the page's own
same-site links. It never submits a form, applies, registers, signs up or logs in —
controls that would change something on the other site are handed back for you to
click yourself.
"""

from __future__ import annotations

import re
from html import unescape
from urllib.parse import urljoin, urlparse

from .agent import fetch_text

MAX_LINKS = 40
MAX_BUTTONS = 20
MAX_ICONS = 20
MAX_TEXT = 4000

# Blocks whose contents are not part of the readable page (svgs are inventoried below).
BLOCKS = re.compile(
    r"<(script|style|noscript|template|svg)\b[^>]*>.*?</\1\s*>", re.I | re.S
)
TITLE = re.compile(r"<title[^>]*>(.*?)</title\s*>", re.I | re.S)
ANCHOR = re.compile(r"<a\b([^>]*)>(.*?)</a\s*>", re.I | re.S)
BUTTON = re.compile(r"<button\b([^>]*)>(.*?)</button\s*>", re.I | re.S)
INPUT = re.compile(r"<input\b([^>]*)>", re.I)
ICON = re.compile(r"<(?:svg|i)\b([^>]*)>", re.I)
ATTR = re.compile(r"([\w:-]+)\s*=\s*[\"']([^\"']*)[\"']")
TAG = re.compile(r"<[^>]+>")
SPACE = re.compile(r"\s+")

PRIVATE_HOST = re.compile(
    r"^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)",
    re.I,
)


def is_public_page(url: str) -> bool:
    parts = urlparse(url)
    return parts.scheme in ("http", "https") and not PRIVATE_HOST.match(parts.hostname or "")


def _attrs(raw: str) -> dict[str, str]:
    return {key.lower(): value for key, value in ATTR.findall(raw or "")}


def _text(fragment: str) -> str:
    return SPACE.sub(" ", unescape(TAG.sub(" ", fragment or ""))).strip()


def _icon_label(attrs: dict[str, str]) -> str:
    for key in ("aria-label", "title", "alt", "data-icon", "name"):
        if attrs.get(key):
            return attrs[key].strip()[:120]
    classes = (attrs.get("class") or "").split()
    return classes[0][:120] if classes else "unlabelled icon"


def _links(html: str, url: str) -> list[dict]:
    found: list[dict] = []
    seen: set[str] = set()
    for raw, inner in ANCHOR.findall(html):
        attrs = _attrs(raw)
        href = urljoin(url, (attrs.get("href") or "").strip())
        if not href.startswith(("http://", "https://")) or href in seen:
            continue
        seen.add(href)
        label = _text(inner) or attrs.get("aria-label") or attrs.get("title") or href
        found.append({"label": label[:160], "kind": "link", "url": href})
        if len(found) >= MAX_LINKS:
            break
    return found


def _buttons(html: str) -> list[dict]:
    found: list[dict] = []
    for raw, inner in BUTTON.findall(html):
        attrs = _attrs(raw)
        label = _text(inner) or attrs.get("aria-label") or attrs.get("title")
        if label:
            found.append(
                {"label": label[:160], "kind": (attrs.get("type") or "button").lower()}
            )
    for raw in INPUT.findall(html):
        attrs = _attrs(raw)
        if (attrs.get("type") or "").lower() not in ("submit", "button", "reset"):
            continue
        label = attrs.get("value") or attrs.get("aria-label") or attrs.get("title")
        if label:
            found.append({"label": label[:160], "kind": "submit"})
    return found[:MAX_BUTTONS]


def _icons(html: str) -> list[dict]:
    found: list[dict] = []
    for raw in ICON.findall(html):
        label = _icon_label(_attrs(raw))
        if all(existing["label"] != label for existing in found):
            found.append({"label": label[:120], "kind": "icon"})
        if len(found) >= MAX_ICONS:
            break
    return found


def snapshot(url: str) -> dict:
    """Read one public page: its title, readable text and every clickable control."""
    if not is_public_page(url):
        raise ValueError("That listing does not point at a public http(s) address")

    html = fetch_text(url)
    body = BLOCKS.sub(" ", html)
    heading = TITLE.search(html)
    title = _text(heading.group(1)) if heading else ""
    return {
        "url": url,
        "title": title[:200] or urlparse(url).path[:200] or url[:200],
        "text": _text(body)[:MAX_TEXT],
        "links": _links(body, url),
        "buttons": _buttons(body),
        "icons": _icons(html),
    }


def follow(url: str, index: int) -> dict:
    """Click one of the page's own links and show where it leads.

    The index refers to the latest screen view of `url`, so the scout only fetches
    links that page itself offered, and only on the same site.
    """
    page = snapshot(url)
    if index >= len(page["links"]):
        raise IndexError(index)
    target = page["links"][index]["url"]
    if urlparse(target).netloc != urlparse(url).netloc:
        raise ValueError("The scout only follows links on the listing's own site")
    return snapshot(target)
