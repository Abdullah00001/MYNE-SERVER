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
    return "On website"


def extract_price(text) -> float | None:
    if not text:
        return None
    if isinstance(text, (int, float)):
        return float(text) if float(text) > 100 else None
    text_str = str(text)
    match = re.search(
        r'[\$£€¥]\s*([\d]{1,3}(?:[,.][\d]{3})*(?:\.\d{1,2})?)', text_str)
    if match:
        try:
            return float(match.group(1).replace(",", ""))
        except:
            pass
    # Fallback to pure numeric extraction
    match_num = re.search(r'\b([\d]{1,3}(?:,\d{3})+|\d{3,6})(?:\.\d{1,2})?\b', text_str)
    if match_num:
        try:
            val = float(match_num.group(1).replace(",", ""))
            if val >= 200:
                return val
        except:
            pass
    return None


BLOCKED_DOMAINS = [
    "instagram.com", "lookaside.instagram.com", "pinterest.com",
    "tiktok.com", "facebook.com", "twitter.com", "reddit.com",
    "serpapi.com",
    "wikimedia.org", "wikipedia.org",
    "blogspot.com", "wordpress.com",
    "aliexpress.com", "dhgate.com",
    "ebay.com", "ebay.co.uk", "ebay.de", "ebay.fr", "ebay.it", "ebay.es", "ebay",
]


def is_clean_url(url: str) -> bool:
    return url and not any(blocked in url.lower() for blocked in BLOCKED_DOMAINS)


def is_blocked_source(url: str = "", source: str = "") -> bool:
    url_l = (url or "").lower()
    src_l = (source or "").lower()
    if "ebay" in url_l or "ebay" in src_l:
        return True
    return any(blocked in url_l for blocked in BLOCKED_DOMAINS)


REJECT_KEYWORDS = [
    "strap", "shoulder strap", "charm", "bag charm", "wallet", "card holder",
    "cardholder", "keychain", "key holder", "pouch", "dust bag", "dustbag",
    "box", "scarf", "twilly", "belt", "sunglasses", "shoe", "sneaker",
    "pendant", "ring", "bracelet", "earring", "necklace", "case", "cover",
    "airpods", "organizer", "insert", "shaper", "book", "catalog", "perfume",
    "fragrance", "candle", "mini pouch", "clutch pouch", "chain strap", "handle"
]


def is_non_bag_accessory(title: str) -> bool:
    title_lower = (title or "").lower()
    for kw in REJECT_KEYWORDS:
        if re.search(r'\b' + re.escape(kw) + r'\b', title_lower):
            return True
    return False


async def ai_filter_priced_sources(priced_sources: list, first_title: str) -> tuple[list, list]:
    """Use AI to keep only sources matching the exact or similar bag model, rejecting accessories."""
    if not priced_sources:
        return [], []

    items = [f"{i}: {p['title']} ({p['url']}) — {p['price_raw']}" for i,
             p in enumerate(priced_sources)]
    items_text = "\n".join(items)

    prompt = f"""You are a luxury bag expert evaluating market listings for the target bag: "{first_title}"

Below are search results with titles, URLs, and prices:
{items_text}

Instructions:
1. Return ONLY the numbers of listings that are ACTUAL HANDBAGS matching the brand and model family of "{first_title}".
2. REJECT any listing that is an accessory, strap, charm, wallet, cardholder, pouch, dust bag, box, shoe, or unrelated item.
3. REJECT any listing that is a completely different brand or unrelated bag model.

Reply with only comma-separated numbers (e.g. 0,2,4). If none match, reply "none"."""

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}",
                         "Content-Type": "application/json"},
                json={"model": "gpt-4o-mini",
                      "messages": [{"role": "user", "content": prompt}],
                      "max_tokens": 100}
            )
            result = res.json()["choices"][0]["message"]["content"].strip()
            print(f"[ai_filter] target: '{first_title}' | kept: {result}")

            if result.lower() == "none":
                return [], priced_sources

            indices = [int(x.strip())
                       for x in result.split(",") if x.strip().isdigit()]
            matched = [priced_sources[i]
                       for i in indices if i < len(priced_sources)]
            return matched, []

    except Exception as e:
        print(f"[ai_filter] failed: {e} — returning pre-filtered list")
        return priced_sources, []

# ─────────────────────────────────────────
# STEP 2 — Google Lens + SerpAPI Shopping Fallback
# ─────────────────────────────────────────


async def get_lens_prices(image_url: str) -> list[dict]:
    lens_url = image_url

    try:
        async with httpx.AsyncClient(timeout=10) as client:
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
        domain = m.get("source") or (re.search(r'(?:https?://)?(?:www\.)?([^/]+)', link).group(1) if re.search(r'(?:https?://)?(?:www\.)?([^/]+)', link) else "unknown")
        priced_sources.append({
            "title": m.get("title", ""),
            "price_raw": price_raw,
            "url": link,
            "source": str(domain)
        })

    logger.info(
        f"[get_lens_prices] Found {len(priced_sources)} priced results")
    priced_sources = priced_sources[:25]
    return priced_sources


def sanitize_search_query(query: str) -> str:
    if not query:
        return ""

    noise_words = {
        "standard", "excellent", "very good", "good", "fair", "poor", "new",
        "lather", "leather", "condition", "hardware", "none", "bag", "used",
        "pre-owned", "preowned", "authentic", "original", "luxury"
    }

    words = query.split()
    cleaned_words = []
    seen = set()

    for w in words:
        w_clean = re.sub(r'[^\w\s]', '', w)
        w_lower = w_clean.lower()
        if not w_lower or w_lower in noise_words or w_lower in seen:
            continue
        seen.add(w_lower)
        cleaned_words.append(w_clean)

    # Keep top 6 essential words (e.g. Gucci Ophidia Small Shoulder GG Supreme)
    short_query = " ".join(cleaned_words[:6])
    return short_query if short_query else query


async def search_priority_sites(query: str) -> list[dict]:
    """Search PRIORITY_SITES directly via Google using the bag query."""
    if not query:
        return []
    clean_q = sanitize_search_query(query)
    site_filter = " OR ".join(f"site:{s}" for s in PRIORITY_SITES)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(
                "https://serpapi.com/search",
                params={
                    "engine": "google",
                    "q": f"({site_filter}) {clean_q}",
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
                        "condition_raw": "On website"
                    })
            logger.info(f"[priority_sites] Found {len(results)} results")
            return results
    except Exception as e:
        logger.warning(f"[priority_sites] Failed: {e}")
        return []


async def fetch_serpapi_shopping_sources(query: str) -> list[dict]:
    """Fallback search using SerpAPI Google Shopping endpoint with query sanitization & multi-tier fallback."""
    if not query or not SERP_API_KEY:
        return []

    clean_q = sanitize_search_query(query)
    queries_to_try = [clean_q]

    words = clean_q.split()
    if len(words) > 3:
        queries_to_try.append(" ".join(words[:4]))

    results = []
    seen_urls = set()

    async with httpx.AsyncClient(timeout=10) as client:
        for q in queries_to_try:
            try:
                res = await client.get(
                    "https://serpapi.com/search",
                    params={
                        "engine": "google_shopping",
                        "q": q,
                        "api_key": SERP_API_KEY,
                        "num": 20
                    }
                )
                if res.status_code == 200:
                    for item in res.json().get("shopping_results", []):
                        raw_p = item.get("price") or item.get("extracted_price") or ""
                        price = extract_price(str(raw_p))
                        link = item.get("link") or item.get("product_link", "")
                        merchant = item.get("source", "").strip()
                        title = item.get("title", "")
                        if price and price >= 200 and link and link not in seen_urls and not is_blocked_source(link, merchant):
                            seen_urls.add(link)
                            domain = merchant if merchant else "Reseller"
                            results.append({
                                "title": title,
                                "price_raw": str(raw_p),
                                "url": link,
                                "source": domain,
                                "country": get_country(domain),
                                "condition_raw": "On website"
                            })
                if len(results) >= 5:
                    break
            except Exception as e:
                logger.warning(f"[serpapi_shopping] Failed for query '{q}': {e}")

    logger.info(f"[serpapi_shopping] Found {len(results)} market sources from SerpAPI Shopping")
    return results

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

    raw_priced_sources = priority_sources + lens_sources

    if not reference and lens_sources:
        reference = lens_sources[0]["title"]

    # Fetch SerpAPI Shopping sources to ensure 5+ listings
    shopping_sources = []
    if reference:
        shopping_sources = await fetch_serpapi_shopping_sources(reference)
        raw_priced_sources.extend(shopping_sources)

    # 1. Pre-filter out non-bag accessories and blocked domains (e.g. eBay)
    filtered_by_keyword = [
        item for item in raw_priced_sources
        if not is_non_bag_accessory(item.get("title", "")) and not is_blocked_source(item.get("url", ""), item.get("source", ""))
    ]

    # 2. Extract brand from reference (if available) and filter out completely different brands
    brand_hint = reference.split()[0].lower() if reference else ""
    known_brands = ["gucci", "chanel", "louis", "hermes", "prada", "loewe", "dior", "celine", "saint", "bottega", "balenciaga", "fendi", "burberry", "valentino", "givenchy", "miu"]
    if brand_hint in known_brands:
        filtered_by_brand = []
        for item in filtered_by_keyword:
            t_lower = item.get("title", "").lower()
            if brand_hint in t_lower or any(b in t_lower for b in [brand_hint, "louis vuitton", "saint laurent", "bottega veneta"]):
                filtered_by_brand.append(item)
        if filtered_by_brand:
            filtered_by_keyword = filtered_by_brand

    # 3. AI filter candidate listings for relevance to target bag
    if reference and filtered_by_keyword:
        ai_filtered_sources, _ = await ai_filter_priced_sources(filtered_by_keyword, reference)
        priced_sources = ai_filtered_sources if ai_filtered_sources else filtered_by_keyword
    else:
        priced_sources = filtered_by_keyword

    print(
        f"[fetch_prices_from_image] {len(raw_priced_sources)} raw → {len(filtered_by_keyword)} non-accessory → {len(priced_sources)} AI-matched")

    valid_priced_items = []
    for item in priced_sources:
        price = extract_price(item["price_raw"])
        if price and price >= 200:
            symbol = detect_currency_symbol(item["price_raw"])
            eur = to_eur(price, symbol)
            valid_priced_items.append({
                "eur": eur,
                "original": price,
                "currency": symbol,
                "source": item["source"],
                "url": item["url"],
                "title": item["title"],
                "country": item.get("country", "Global"),
                "condition": "On website"
            })

    # Deduplicate by unique listing URL
    seen = {}
    for p in valid_priced_items:
        url_key = p["url"].split("?")[0].rstrip("/").lower()
        if url_key not in seen:
            seen[url_key] = p
    prices = list(seen.values())

    # compute most common price cluster
    if prices:
        sorted_prices = sorted(prices, key=lambda x: x["eur"])

        # group prices within 15% of each other
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
        "reference_sources": []
    }