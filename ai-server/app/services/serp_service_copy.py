import re
import httpx
import asyncio
from app.config import OPENAI_API_KEY, SERP_API_KEY, SERPER_API_KEY

import logging
logger = logging.getLogger(__name__)

PRIORITY_SITES = [
    "madisonavenuecouture.com",
    "vestiairecollective.com",
    "therealreal.com",
    "sothebys.com",
    "fashionphile.com",
    "loveluxury.co.uk",   # ← add
    "loveluxury.ae",      # ← add
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
    "loveluxury.co.uk": "🇬🇧 UK",
    "loveluxury.ae": "🇦🇪 UAE",
 
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
    domain_clean = domain.lower().replace("www.", "")
    return DOMAIN_COUNTRY.get(domain_clean, "🌐 Global")


# ─────────────────────────────────────────
# LIVE RATES
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
                params={"from": "EUR", "to": "USD,GBP,JPY,CNY,CHF"}
            )
            res.raise_for_status()
            data = res.json()
        for currency, rate in data["rates"].items():
            _rate_cache["rates"][currency] = round(1 / rate, 6)
        _rate_cache["last_updated"] = now
        print(f"[rates] Refreshed: {_rate_cache['rates']}")
    except Exception as e:
        print(f"[rates] Using cached: {e}")


def to_eur(price: float, symbol: str) -> float:
    symbol_to_curr = {"$": "USD", "£": "GBP", "€": "EUR", "¥": "JPY"}
    curr = symbol_to_curr.get(symbol, "EUR")
    if curr == "EUR":
        return round(price, 2)
    rate = _rate_cache["rates"].get(curr, 1.0)
    return round(price * rate, 2)


def detect_currency_symbol(text: str) -> str:
    text = str(text)
    if "$" in text or "USD" in text:
        return "$"
    if "£" in text or "GBP" in text:
        return "£"
    if "€" in text or "EUR" in text:
        return "€"
    if "¥" in text:
        return "¥"
    return "€"


# ─────────────────────────────────────────
# STEP 1 — Scrape product condition
# ─────────────────────────────────────────


def extract_condition(html_text: str) -> str:
    text = html_text.lower()
    keywords = [
        ("store fresh", "Pristine / Store Fresh"),
        ("never worn", "Pristine / Store Fresh"),
        ("pristine", "Pristine / Store Fresh"),
        ("new with tags", "Pristine / Store Fresh"),
        ("excellent condition", "Excellent"),
        ("very good condition", "Very Good"),
        ("good condition", "Good"),
        ("fair condition", "Fair"),
    ]
    for key, label in keywords:
        if key in text:
            return label
    return "On website"


async def scrape_condition(url: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=6, follow_redirects=True) as client:
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

    items = [f"{i}: {p['title']} ({p['url']}) — {p['price_raw']}" for i,
             p in enumerate(priced_sources)]
    items_text = "\n".join(items)

    prompt = f"""You are a luxury bag expert.
Target bag identified as: "{first_title}"

Below are search results with titles, URLs, and prices.
Return ONLY the numbers of listings that are the EXACT same bag and could be used for pricing reference.

Rules:
- EXACT match = same brand, model, material, color, size, and EDITION → include. (If the target is a Limited Edition or Collaboration, standard versions MUST be rejected).
- REJECT any listing that differs in size, material, color, model, or edition.
- REJECT any generic category pages, search pages, or blog posts (e.g. URLs lacking a specific product ID, or titles like "Chanel Bags - Buy & Sell").
- When in doubt, REJECT it. Do not include loose matches.

The goal is to gather ONLY highly accurate comparables for valuation.

Reply with only comma-separated numbers. If none match, reply "none".

Results:
{items_text}"""

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}",
                         "Content-Type": "application/json"},
                json={"model": "gpt-4o",
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
# STEP 2 — Google Lens + Serper Fallback
# ─────────────────────────────────────────


async def get_lens_prices(image_url: str) -> list[dict]:
    lens_url = image_url

    try:
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
    except Exception as e:
        logger.error(f"[get_lens_prices] SerpAPI Lens request failed: {e}")
        return []

    priced_sources = []
    for m in data.get("visual_matches", []):
        price_obj = m.get("price")
        price_raw = ""
        if isinstance(price_obj, dict):
            price_raw = str(price_obj.get("value") or price_obj.get("extracted_value") or "")
            if price_obj.get("currency") and price_obj.get("extracted_value"):
                price_raw = f"{price_obj.get('currency')} {price_obj.get('extracted_value')}"
        elif price_obj:
            price_raw = str(price_obj)
        elif m.get("extracted_price"):
            price_raw = str(m.get("extracted_price"))

        link = m.get("link", "")
        if not price_raw or not link:
            continue
        domain = re.search(r'(?:https?://)?(?:www\.)?([^/]+)', link)
        priced_sources.append({
            "title": m.get("title", ""),
            "price_raw": price_raw,
            "url": link,
            "source": domain.group(1) if domain else "unknown"
        })

    logger.info(
        f"[get_lens_prices] Found {len(priced_sources)} priced results")
    priced_sources = priced_sources[:25]
    return priced_sources


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


async def fetch_serper_fallback_sources(query: str) -> list[dict]:
    """Fallback search using Serper API Shopping endpoint when SerpAPI fails or returns few results."""
    if not query or not SERPER_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                "https://google.serper.dev/shopping",
                headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
                json={"q": query, "num": 20}
            )
            if res.status_code != 200:
                return []
            data = res.json()
            results = []
            for item in data.get("shopping", []):
                raw_p = item.get("price", "")
                price = extract_price(raw_p)
                link = item.get("link") or item.get("productLink", "")
                merchant = item.get("source", "").strip()
                title = item.get("title", "")
                if price and price > 200 and link:
                    domain = merchant if merchant else "Reseller"
                    results.append({
                        "title": title,
                        "price_raw": str(raw_p),
                        "url": link,
                        "source": domain,
                        "country": get_country(domain),
                        "condition_raw": "On website"
                    })
            logger.info(f"[serper_fallback] Found {len(results)} market sources from Serper")
            return results
    except Exception as e:
        logger.warning(f"[serper_fallback] Serper Shopping failed: {e}")
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

    if not reference and lens_sources:
        reference = lens_sources[0]["title"]

    # If SerpAPI returned fewer than 5 sources, fetch from Serper API Shopping as reliable fallback
    serper_sources = []
    if len(priced_sources) < 5 and reference:
        serper_sources = await fetch_serper_fallback_sources(reference)
        priced_sources.extend(serper_sources)

    print(
        f"[pre-filter] {len(priced_sources)} priced sources ({len(priority_sources)} priority, {len(lens_sources)} lens, {len(serper_sources)} serper):")
    for i, p in enumerate(priced_sources):
        print(f"  {i}: {p['source']} | {p['title']} | {p['price_raw']}")

    matched_sources, reference_sources = await ai_filter_priced_sources(priced_sources, reference)

    # If AI filter rejected everything or returned fewer than 3, keep serper_sources
    if len(matched_sources) < 3 and serper_sources:
        matched_sources = list(matched_sources) + [s for s in serper_sources if s not in matched_sources]

    final_sources = matched_sources if matched_sources else priced_sources

    # Scrape condition concurrently for all matched sources
    condition_tasks = [scrape_condition(item["url"])
                       for item in final_sources]
    scraped_conditions = await asyncio.gather(*condition_tasks)

    prices = []
    for i, item in enumerate(final_sources):
        price = extract_price(item["price_raw"])
        if not price or price < 200:
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

    # deduplicate by source + title snippet
    seen = {}
    for p in prices:
        key = f"{p['source']}_{p['title'][:20]}".lower()
        if key not in seen:
            seen[key] = p
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