import re
import httpx
import asyncio
from typing import Dict, Any
from app.config import OPENAI_API_KEY, SERP_API_KEY

import logging
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────
# EXCHANGE RATES
# ─────────────────────────────────────────

_rate_cache = {
    "rates": {"USD": 0.92, "GBP": 1.17, "JPY": 0.0062, "CNY": 0.13},
    "last_updated": None
}


async def refresh_rates():
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    last = _rate_cache["last_updated"]
    if last and (now - last) < timedelta(hours=24):
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(
                "https://api.frankfurter.dev/v1/latest",
                params={"from": "EUR", "to": "USD,GBP,JPY,CNY"}
            )
            res.raise_for_status()
            for currency, rate in res.json()["rates"].items():
                _rate_cache["rates"][currency] = round(1 / rate, 6)
        _rate_cache["last_updated"] = now
    except Exception as e:
        print(f"[rates] Failed: {e}")


def detect_currency_symbol(text: str) -> str:
    text = str(text)
    if "$" in text:
        return "$"
    if "£" in text:
        return "£"
    if "€" in text:
        return "€"
    if "¥" in text:
        return "¥"
    return "€"


def to_eur(price: float, symbol: str) -> float:
    mapping = {"$": "USD", "£": "GBP", "€": "EUR", "¥": "JPY"}
    currency = mapping.get(symbol, "EUR")
    if currency == "EUR":
        return round(price, 2)
    rate = _rate_cache["rates"].get(currency, 1.0)
    return round(price * rate, 2)


def extract_price(text) -> float | None:
    if not text:
        return None
    if isinstance(text, (int, float)):
        return float(text)
    match = re.search(
        r'[\$£€¥]\s*([\d]{1,3}(?:[,.][\d]{3})*(?:\.\d{1,2})?)', str(text))
    if not match:
        return None
    try:
        return float(match.group(1).replace(",", ""))
    except:
        return None


async def ai_filter_priced_sources(priced_sources: list, first_title: str) -> list:
    """Use AI to keep only sources matching the exact bag."""
    if not priced_sources:
        return []

    items = [f"{i}: {p['title']} — {p['price_raw']}" for i,
             p in enumerate(priced_sources)]
    items_text = "\n".join(items)

    prompt = f"""You are a luxury bag expert.
Target bag identified as: "{first_title}"

Below are search results with titles and prices.
Return ONLY the numbers of listings that are the EXACT same bag.

Rules:
- Different names can refer to the same bag (e.g. "Mini Kelly II" = "Mini Kelly 20", "Classic Flap" = "2.55") — use your knowledge to match them
- ONLY reject if you are confident it is a different size, model, or brand
- When in doubt, INCLUDE it
- Ignore blog posts, guides, or category pages

Reply with only comma-separated numbers. If none match, reply "none".

Results:
{items_text}"""

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}",
                         "Content-Type": "application/json"},
                json={"model": "gpt-4o-mini",
                      "messages": [{"role": "user", "content": prompt}],
                      "max_tokens": 100}
            )
            result = res.json()["choices"][0]["message"]["content"].strip()
            print(f"[ai_filter] kept: {result}")
            if result.lower() == "none":
                return []
            indices = [int(x.strip())
                       for x in result.split(",") if x.strip().isdigit()]
            return [priced_sources[i] for i in indices if i < len(priced_sources)]
    except Exception as e:
        print(f"[ai_filter] failed: {e} — returning all")
        return priced_sources

# ─────────────────────────────────────────
# STEP 1 — upload image to get public URL
# ─────────────────────────────────────────


async def upload_image(photo_b64: str, photo_mime: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://freeimage.host/api/1/upload",
            data={
                "key": "6d207e02198a847aa98d0a2a901485a5",
                "action": "upload",
                "source": photo_b64,
                "format": "json",
            }
        )
        response.raise_for_status()
        url = response.json()["image"]["url"]
        logger.info(f"[upload_image] {url}")
        return url

# ─────────────────────────────────────────
# STEP 2 — Google Lens → get priced sources
# ─────────────────────────────────────────


async def get_lens_prices(photo_b64: str, photo_mime: str, image_url: str) -> list[dict]:

    if image_url:
        lens_url = image_url
    else:
        lens_url = await upload_image(photo_b64, photo_mime)

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            "https://serpapi.com/search",
            params={
                "engine": "google_lens",
                "url": image_url,
                "api_key": SERP_API_KEY,
            }
        )
        response.raise_for_status()
        data = response.json()
        print(
            f"[get_lens_prices] got {len(data.get('visual_matches', []))} matches from Lens")

    priced_sources = []
    for m in data.get("visual_matches", []):
        price_raw = m.get("price", {}).get("value", "")
        link = m.get("link", "")
        if not price_raw or not link:
            continue
        domain = re.search(r'(?:https?://)?(?:www\.)?([^/]+)', link)
        priced_sources.append({
            "title": m.get("title", ""),
            "price_raw": str(price_raw),
            "url": link,
            "source": domain.group(1) if domain else "unknown"
        })

    logger.info(
        f"[get_lens_prices] Found {len(priced_sources)} priced results")
    return priced_sources

# ─────────────────────────────────────────
# STEP 3 — parse, clean, return
# ─────────────────────────────────────────


async def fetch_prices_from_image(photo_b64: str, photo_mime: str, image_search_query: str = "", image_url: str = "") -> dict:
    await refresh_rates()

    priced_sources = await get_lens_prices(photo_b64, photo_mime, image_url)

    # TRUSTED_SOURCES = [
    #     "vestiaire", "therealreal", "1stdibs", "rebag", "fashionphile",
    #     "madisonavenuecouture", "baghunter", "collector-square", "sothebys",
    #     "christies", "bonhams", "saclab", "priveporter", "mightychic",
    #     "jewelsaficionado", "janefinds", "luxaddicts", "sellierknightsbridge",
    #     "theluxurycloset", "annsfabulousfinds", "revolve"
    # ]

    # # filter to trusted sources only
    # priced_sources = [
    #     p for p in priced_sources
    #     if any(site in p["source"] for site in TRUSTED_SOURCES)
    # ]
    # print(f"[trusted filter] {len(priced_sources)} sources after trust filter")

    # use image_search_query as reference if available, else fall back to first title
    reference = image_search_query if image_search_query else (
        priced_sources[0]["title"] if priced_sources else "")
    priced_sources = await ai_filter_priced_sources(priced_sources, reference)

    prices = []
    for item in priced_sources:
        price = extract_price(item["price_raw"])
        if not price or price < 300:
            continue
        symbol = detect_currency_symbol(item["price_raw"])
        eur = to_eur(price, symbol)
        prices.append({
            "eur": eur,
            "original": price,
            "currency": symbol,
            "source": item["source"],
            "url": item["url"],
            "title": item["title"]
        })
        print(f"[price] {item['source']} → {symbol}{price} = €{eur}")

    # deduplicate by domain
    seen = {}
    for p in prices:
        if p["source"] not in seen:
            seen[p["source"]] = p
    prices = list(seen.values())

    # compute median
    if prices:
        sorted_prices = sorted(prices, key=lambda x: x["eur"])
        n = len(sorted_prices)
        resale_price = round(
            (sorted_prices[n//2-1]["eur"] + sorted_prices[n//2]["eur"]) / 2, 2
        ) if n % 2 == 0 else round(sorted_prices[n//2]["eur"], 2)
    else:
        resale_price = None

    total = len(prices)
    if total < 3:
        status = "Not enough data"
    elif total < 6:
        status = "Limited data — estimate may vary"
    else:
        status = "Good data — high confidence"

    return {
        "resale_price": resale_price,
        "data_points": total,
        "valuation_status": status,
        "sources": sorted(prices, key=lambda x: x["eur"])
    }
