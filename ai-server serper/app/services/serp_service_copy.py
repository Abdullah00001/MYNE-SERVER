import re
import httpx
import asyncio
from app.config import OPENAI_API_KEY, SERP_API_KEY

import logging
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────
# PRIORITY SITES
# ─────────────────────────────────────────

PRIORITY_SITES = [
    "madisonavenuecouture.com",
    "vestiairecollective.com",
    "therealreal.com",
    "sothebys.com",
    "fashionphile.com"
    # add more here
]

# ─────────────────────────────────────────
# Domain SITES
# ─────────────────────────────────────────


DOMAIN_COUNTRY = {
    "madisonavenuecouture.com": "🇺🇸 USA",
    "vestiairecollective.com": "🇫🇷 France",
    "therealreal.com": "🌐 Global",
    "sothebys.com": "🌐 Global",
    "fashionphile.com": "🇺🇸 USA",
    "1stdibs.com": "🌐 Global",
    "ebay.com": "🌐 Global",
    "ebay.co.uk": "🇬🇧 UK",
    "ebay.de": "🇩🇪 Germany",
    "ebay.fr": "🇫🇷 France",
    "chrisbella.com": "🇬🇧 UK",
    "tradesy.com": "🇺🇸 USA",
    "rebag.com": "🇺🇸 USA",
    "luxepolis.com": "🇮🇳 India",
    "collector-square.com": "🇫🇷 France",
    "sacprimeur.com": "🇫🇷 France",
    "bagborroworsteal.com": "🇺🇸 USA",

    # Global
    "jamesedition.com": "🌐 Global",
    "catawiki.com": "🌐 Global",
    "christies.com": "🌐 Global",
    "bonhams.com": "🌐 Global",

    # US
    "poshmark.com": "🇺🇸 USA",
    "yoogi.com": "🇺🇸 USA",
    "portero.com": "🇺🇸 USA",
    "tradesy.com": "🇺🇸 USA",

    # UK
    "sellmybag.co.uk": "🇬🇧 UK",
    "designerexchange.co.uk": "🇬🇧 UK",
    "hardly-ever-worn-it.com": "🇬🇧 UK",

    # France / Europe
    "videdressing.com": "🇫🇷 France",
    "collector-square.com": "🇫🇷 France",

    # Japan (huge luxury resale market)
    "brandoff.jp": "🇯🇵 Japan",
    "komehyo.jp": "🇯🇵 Japan",
}


def get_country(domain: str) -> str:
    for key, country in DOMAIN_COUNTRY.items():
        if key in domain:
            return country
    return "🌐 Global"


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


def extract_condition(text: str) -> str:
    text_lower = text.lower()
    if "very good" in text_lower:
        return "Very Good"
    if "excellent" in text_lower:
        return "Excellent"
    if "good" in text_lower:
        return "Good"
    if "fair" in text_lower:
        return "Fair"
    if "poor" in text_lower:
        return "Poor"
    if any(x in text_lower for x in ["never worn", "brand new", "new with tags", "unworn", "pristine"]):
        return "New"
    return "On website"


async def scrape_condition(url: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            res = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            return extract_condition(res.text)
    except:
        return "On website"


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
        return [], []

    items = [f"{i}: {p['title']} — {p['price_raw']}" for i,
             p in enumerate(priced_sources)]
    items_text = "\n".join(items)

    prompt = f"""You are a luxury bag expert.
Target bag identified as: "{first_title}"

Below are search results with titles and prices.
Return ONLY the numbers of listings that are the EXACT same bag and also could be used for pricing reference.

Rules:
- EXACT match = same brand, model, size → include
- CLOSE match = same brand, same material/variant (e.g. Himalaya Crocodile), different size → include (useful for pricing reference)
- REJECT only if completely different brand or completely unrelated model
- REJECT: blog posts, guides, "how to buy" articles with no specific listing price
- When in doubt, INCLUDE it

The goal is to gather as many relevant price data points as possible for accurate valuation.

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
                print("[ai_filter] none matched — passing as silent reference only")
                return [], priced_sources

            indices = [int(x.strip())
                       for x in result.split(",") if x.strip().isdigit()]
            matched = [priced_sources[i]
                       for i in indices if i < len(priced_sources)]
            return matched, []

    except Exception as e:
        print(f"[ai_filter] failed: {e} — returning all")
        return priced_sources, []

# ─────────────────────────────────────────
# STEP 1 — upload image to get public URL
# ─────────────────────────────────────────


# async def upload_image(photo_b64: str, photo_mime: str) -> str:
#     async with httpx.AsyncClient(timeout=30) as client:
#         response = await client.post(
#             "https://freeimage.host/api/1/upload",
#             data={
#                 "key": "6d207e02198a847aa98d0a2a901485a5",
#                 "action": "upload",
#                 "source": photo_b64,
#                 "format": "json",
#             }
#         )
#         response.raise_for_status()
#         url = response.json()["image"]["url"]
#         logger.info(f"[upload_image] {url}")
#         return url

# ─────────────────────────────────────────
# STEP 2 — Google Lens → get priced sources
# ─────────────────────────────────────────


async def get_lens_prices(image_url: str) -> list[dict]:
    lens_url = image_url

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            "https://serpapi.com/search",
            params={
                "engine": "google_lens",
                "url": lens_url,
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
    priced_sources = priced_sources[:25]
    return priced_sources

# ─────────────────────────────────────────
# STEP 2b — Search priority sites directly
# ─────────────────────────────────────────


async def search_priority_sites(query: str) -> list[dict]:
    """Search PRIORITY_SITES directly via Google using the bag query."""
    if not query:
        return []
    site_filter = " OR ".join(f"site:{s}" for s in PRIORITY_SITES)
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.get(
                "https://serpapi.com/search",
                params={
                    "engine": "google",
                    "q": f"({site_filter}) {query}",
                    "api_key": SERP_API_KEY,
                    "num": 10,
                }
            )
            res.raise_for_status()
            results = []
            for r in res.json().get("organic_results", []):
                link = r.get("link", "")
                snippet = r.get("snippet", "") + " " + r.get("title", "")
                price = extract_price(snippet)
                domain = re.search(r'(?:https?://)?(?:www\.)?([^/]+)', link)
                domain_str = domain.group(1) if domain else "unknown"
                if price and link:
                    results.append({
                        "title": r.get("title", ""),
                        "price_raw": snippet,
                        "url": link,
                        "source": domain_str,
                        "country": get_country(domain_str),
                        "condition_raw": ""
                    })
            logger.info(f"[priority_sites] Found {len(results)} results")
            return results
    except Exception as e:
        logger.warning(f"[priority_sites] Failed: {e}")
        return []

# ─────────────────────────────────────────
# STEP 3 — parse, clean, return
# ─────────────────────────────────────────


async def fetch_prices_from_image(image_url: str, image_search_query: str = "") -> dict:
    await refresh_rates()

    # Run Lens + priority site search concurrently
    reference = image_search_query
    lens_task = get_lens_prices(image_url)
    priority_task = search_priority_sites(reference)
    lens_sources, priority_sources = await asyncio.gather(lens_task, priority_task)

    # Priority sources go first so AI filter and dedup favour them
    priced_sources = priority_sources + lens_sources

    print(
        f"[pre-filter] {len(priced_sources)} priced sources ({len(priority_sources)} priority, {len(lens_sources)} lens):")
    for i, p in enumerate(priced_sources):
        print(f"  {i}: {p['source']} | {p['title']} | {p['price_raw']}")

    if not reference and lens_sources:
        reference = lens_sources[0]["title"]

    priced_sources, reference_sources = await ai_filter_priced_sources(priced_sources, reference)

    # Scrape condition concurrently for all matched sources
    condition_tasks = [scrape_condition(item["url"])
                       for item in priced_sources]
    scraped_conditions = await asyncio.gather(*condition_tasks)

    prices = []
    for i, item in enumerate(priced_sources):
        price = extract_price(item["price_raw"])
        if not price or price < 300:
            continue
        symbol = detect_currency_symbol(item["price_raw"])
        eur = to_eur(price, symbol)

        condition = item.get("condition_raw") or scraped_conditions[i]

        prices.append({
            "eur": eur,
            "original": price,
            "currency": symbol,
            "source": item["source"],
            "url": item["url"],
            "title": item["title"],
            "country": item.get("country", "Global"),
            "condition": condition
        })
        print(f"[price] {item['source']} → {symbol}{price} = €{eur}")

    # deduplicate by domain (priority sources were prepended so they win dedup)
    seen = {}
    for p in prices:
        if p["source"] not in seen:
            seen[p["source"]] = p
    prices = list(seen.values())

    # compute most common price cluster
    if prices:
        sorted_prices = sorted(prices, key=lambda x: x["eur"])

        # group prices within 10% of each other
        clusters = []
        for p in sorted_prices:
            placed = False
            for cluster in clusters:
                if abs(p["eur"] - cluster[0]["eur"]) / cluster[0]["eur"] < 0.15:
                    cluster.append(p)
                    placed = True
                    break
            if not placed:
                clusters.append([p])

        # pick the cluster with the most sources
        best_cluster = max(clusters, key=lambda c: len(c))
        resale_price = round(sum(p["eur"]
                             for p in best_cluster) / len(best_cluster), 2)
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
        "sources": sorted(prices, key=lambda x: x["eur"]),
        "reference_sources": reference_sources
    }
