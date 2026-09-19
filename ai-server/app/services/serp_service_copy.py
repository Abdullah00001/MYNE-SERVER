import re
import httpx
import asyncio
from urllib.parse import parse_qs, urlparse, unquote
from app.config import OPENAI_API_KEY, SERP_API_KEY, SERPER_API_KEY

import logging
logger = logging.getLogger(__name__)


def unwrap_merchant_url(url: str) -> str:
    if not url:
        return ""
    url_str = str(url).strip()
    if "google.com/url" in url_str or "google.com/aclk" in url_str or "serpapi.com/link" in url_str:
        try:
            parsed = urlparse(url_str)
            qs = parse_qs(parsed.query)
            if "q" in qs and qs["q"]:
                return unquote(qs["q"][0])
            if "url" in qs and qs["url"]:
                return unquote(qs["url"][0])
            if "adurl" in qs and qs["adurl"]:
                return unquote(qs["adurl"][0])
        except Exception:
            pass
    return url_str

PRIORITY_SITES = [
    "madisonavenuecouture.com",
    "janefinds.com",
    "vestiairecollective.com",
    "therealreal.com",
    "sothebys.com",
    "fashionphile.com",
    "rebag.com",
    "1stdibs.com",
    "collector-square.com",
    "loveluxury.co.uk",
    "loveluxury.ae",
    "saclab.co",
    "saclab.com",
    "stockx.com",
    "komehyo.jp",
    "yoogiscloset.com",
    "priveporter.com",
    "baghunter.com",
    "ginza-xiaoma.com",
    "brandoff.jp",
    "designerexchange.co.uk",
    "sellierknightsbridge.com",
    "farfetch.com",
]

PRIORITY_KEYWORDS = [
    "madisonavenuecouture", "janefinds", "vestiaire", "therealreal", "sothebys",
    "fashionphile", "loveluxury", "1stdibs", "rebag", "collector-square",
    "collectorsquare", "saclab", "stockx", "komehyo", "yoogi", "priveporter",
    "baghunter", "ginza", "xiaoma", "brandoff", "designerexchange",
    "videdressing", "hardlyeverwornit", "christies", "catawiki", "jamesedition",
    "farfetch", "sellier"
]


def is_priority_source(url: str = "", source: str = "") -> bool:
    src_l = (source or "").lower()
    url_l = (url or "").lower()
    return any(k in src_l or k in url_l for k in PRIORITY_KEYWORDS)

 
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
        val = float(text)
        return val if val >= 250 else None

    text_str = str(text)

    # 1. Extract all currency-prefixed numbers from the text
    matches = re.findall(
        r'([\$£€¥])\s*([\d]{1,3}(?:[,.][\d]{3})*(?:\.\d{1,2})?)', text_str)

    candidates = []
    for symbol, num_str in matches:
        try:
            clean_num = float(num_str.replace(",", ""))
            eur_val = to_eur(clean_num, symbol)
            # Filter out shipping fees, tax notes, small accessory charges (< €250)
            if eur_val >= 250:
                candidates.append((clean_num, eur_val))
        except Exception:
            pass

    if candidates:
        # In a luxury bag listing snippet, main item price is higher than shipping/fee noise.
        # Pick candidate with highest EUR value.
        candidates.sort(key=lambda x: x[1], reverse=True)
        return candidates[0][0]

    # 2. Fallback to pure numeric extraction if currency symbol is missing
    match_num = re.finditer(
        r'\b([\d]{1,3}(?:,\d{3})+|\d{4,6})(?:\.\d{1,2})?\b', text_str)
    num_candidates = []
    for m in match_num:
        try:
            val = float(m.group(1).replace(",", ""))
            if val >= 400:
                num_candidates.append(val)
        except Exception:
            pass

    if num_candidates:
        num_candidates.sort(reverse=True)
        return num_candidates[0]

    return None


BLOCKED_DOMAINS = [
    "youtube.com", "youtu.be", "googlevideo.com",
    "instagram.com", "lookaside.instagram.com", "pinterest.com",
    "tiktok.com", "facebook.com", "twitter.com", "x.com", "reddit.com",
    "serpapi.com", "serper.dev",
    "wikimedia.org", "wikipedia.org",
    "blogspot.com", "wordpress.com", "tumblr.com", "medium.com",
    "aliexpress.com", "dhgate.com", "shein.com", "temu.com", "wish.com",
    "amazon.com", "walmart.com", "target.com",
    "ebay.com", "ebay.co.uk", "ebay.de", "ebay.fr", "ebay.it", "ebay.es", "ebay",
]

BLOCKED_KEYWORDS_IN_SOURCE = [
    "youtube", "facebook", "instagram", "tiktok", "pinterest", "twitter",
    "reddit", "amazon", "ebay", "walmart", "target", "dhgate", "aliexpress",
    "wikipedia", "blogspot", "wordpress"
]


def is_clean_url(url: str) -> bool:
    return url and not any(blocked in url.lower() for blocked in BLOCKED_DOMAINS)


def is_blocked_source(url: str = "", source: str = "") -> bool:
    url_l = (url or "").lower()
    src_l = (source or "").lower()
    if any(b in src_l for b in BLOCKED_KEYWORDS_IN_SOURCE):
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
    """Search PRIORITY_SITES directly via Google using multi-tier bag queries."""
    if not query:
        return []
    clean_q = sanitize_search_query(query)
    words = clean_q.split()
    queries_to_try = [clean_q]
    if len(words) > 3:
        queries_to_try.append(" ".join(words[:4]))
    if len(words) > 2:
        queries_to_try.append(" ".join(words[:3]))

    site_filter = " OR ".join(f"site:{s}" for s in PRIORITY_SITES)
    results = []
    seen_links = set()

    async with httpx.AsyncClient(timeout=10) as client:
        for q in queries_to_try:
            try:
                res = await client.get(
                    "https://serpapi.com/search",
                    params={
                        "engine": "google",
                        "q": f"({site_filter}) {q}",
                        "api_key": SERP_API_KEY,
                        "num": 15,
                    }
                )
                if res.status_code == 200:
                    for r in res.json().get("organic_results", []):
                        link = r.get("link", "")
                        if not link or link in seen_links or is_blocked_source(link, r.get("title", "")):
                            continue
                        snippet = r.get("snippet", "") + " " + r.get("title", "")
                        price = extract_price(snippet)
                        domain = re.search(r'(?:https?://)?(?:www\.)?([^/]+)', link)
                        domain_str = domain.group(1) if domain else "unknown"
                        if price and price >= 200:
                            seen_links.add(link)
                            results.append({
                                "title": r.get("title", ""),
                                "price_raw": snippet,
                                "url": link,
                                "source": domain_str,
                                "country": get_country(domain_str),
                                "condition_raw": "On website"
                            })
                if len(results) >= 6:
                    break
            except Exception as e:
                logger.warning(f"[priority_sites] Failed for '{q}': {e}")

    logger.info(f"[priority_sites] Found {len(results)} results")
    return results


async def fetch_serpapi_shopping_sources(query: str) -> list[dict]:
    """Fallback search using SerpAPI Google Shopping endpoint with query sanitization & multi-tier fallback."""
    if not query or not SERP_API_KEY:
        return []

    clean_q = sanitize_search_query(query)
    queries_to_try = [clean_q]

    words = clean_q.split()
    if len(words) > 4:
        queries_to_try.append(" ".join(words[:4]))
    if len(words) > 2:
        queries_to_try.append(" ".join(words[:3]))

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
                        "num": 25
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
                if len(results) >= 8:
                    break
            except Exception as e:
                logger.warning(f"[serpapi_shopping] Failed for query '{q}': {e}")

    logger.info(f"[serpapi_shopping] Found {len(results)} market sources from SerpAPI Shopping")
    return results

async def fetch_serper_shopping_sources(query: str) -> list[dict]:
    """Fetch additional luxury reseller listings using Serper.dev Google Shopping API."""
    if not query or not SERPER_API_KEY:
        return []

    clean_q = sanitize_search_query(query)
    words = clean_q.split()
    queries_to_try = [clean_q]
    if len(words) > 4:
        queries_to_try.append(" ".join(words[:4]))
    if len(words) > 2:
        queries_to_try.append(" ".join(words[:3]))

    results = []
    seen_urls = set()

    async with httpx.AsyncClient(timeout=10) as client:
        for q in queries_to_try:
            try:
                res = await client.post(
                    "https://google.serper.dev/shopping",
                    headers={
                        "X-API-KEY": SERPER_API_KEY,
                        "Content-Type": "application/json"
                    },
                    json={"q": q, "num": 25}
                )
                if res.status_code == 200:
                    for item in res.json().get("shopping", []):
                        raw_p = item.get("price") or ""
                        price = extract_price(str(raw_p))
                        link = item.get("link") or item.get("productLink", "")
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
                if len(results) >= 8:
                    break
            except Exception as e:
                logger.warning(f"[serper_shopping] Failed for query '{q}': {e}")

    logger.info(f"[serper_shopping] Found {len(results)} market sources from Serper Shopping")
    return results

# ─────────────────────────────────────────
# STEP 3 — parse, clean, return
# ─────────────────────────────────────────


async def fetch_prices_from_image(image_url: str, image_search_query: str = "") -> dict:
    await refresh_rates()

    reference = image_search_query
    lens_sources = await get_lens_prices(image_url)

    if not reference and lens_sources:
        reference = lens_sources[0]["title"]

    raw_priced_sources = list(lens_sources)

    if reference:
        priority_task = search_priority_sites(reference)
        serpapi_task = fetch_serpapi_shopping_sources(reference)
        serper_task = fetch_serper_shopping_sources(reference)

        p_sources, s_sources, sp_sources = await asyncio.gather(
            priority_task, serpapi_task, serper_task
        )
        raw_priced_sources.extend(p_sources + s_sources + sp_sources)

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
        if len(ai_filtered_sources) >= 4:
            priced_sources = ai_filtered_sources
        else:
            # Preserve additional non-accessory brand matches so we maintain 4-5+ listings minimum
            seen_urls = set(x.get("url") for x in ai_filtered_sources)
            priced_sources = list(ai_filtered_sources)
            for item in filtered_by_keyword:
                if item.get("url") not in seen_urls:
                    seen_urls.add(item.get("url"))
                    priced_sources.append(item)
    else:
        priced_sources = filtered_by_keyword

    print(
        f"[fetch_prices_from_image] {len(raw_priced_sources)} raw → {len(filtered_by_keyword)} non-accessory → {len(priced_sources)} AI-matched")

    valid_priced_items = []
    for item in priced_sources:
        raw_u = item.get("url", "")
        clean_url = unwrap_merchant_url(raw_u)
        src_name = item.get("source", "")
        if is_blocked_source(clean_url, src_name):
            continue
        price = extract_price(item["price_raw"])
        if price and price >= 250:
            symbol = detect_currency_symbol(item["price_raw"])
            eur = to_eur(price, symbol)
            if eur >= 250:
                valid_priced_items.append({
                    "eur": eur,
                    "original": price,
                    "currency": symbol,
                    "source": src_name,
                    "url": clean_url,
                    "title": item["title"],
                    "country": item.get("country") or get_country(src_name),
                    "condition": "On website"
                })

    # Statistical outlier removal: Discard price points < 35% or > 300% of median price
    if len(valid_priced_items) >= 2:
        sorted_eurs = sorted(p["eur"] for p in valid_priced_items)
        median_p = sorted_eurs[len(sorted_eurs) // 2]
        if median_p >= 800:
            min_cutoff = median_p * 0.35
            max_cutoff = median_p * 3.0
            valid_priced_items = [
                p for p in valid_priced_items
                if min_cutoff <= p["eur"] <= max_cutoff
            ]

    # Deduplicate smartly without collapsing Google Shopping or reseller listings into a single URL
    def get_dedup_key(p: dict) -> str:
        raw_url = (p.get("url") or "").lower().rstrip("/")
        if "google.com" in raw_url or "serpapi.com" in raw_url:
            src = (p.get("source") or "").lower()
            ttl = (p.get("title") or "").lower()
            eur = round(p.get("eur", 0))
            return f"google_{src}_{ttl}_{eur}"
        # Keep query parameters if they specify product/variant ID
        clean = re.sub(r'([?&])(utm_[^&]+|gclid=[^&]+|ref=[^&]+|fbclid=[^&]+)', '', raw_url).rstrip("?&")
        return clean

    seen = {}
    for p in valid_priced_items:
        key = get_dedup_key(p)
        if key not in seen:
            seen[key] = p
    prices = list(seen.values())

    # Separate priority reseller listings from general listings
    priority_items = []
    secondary_items = []

    for item in prices:
        if is_priority_source(url=item.get("url", ""), source=item.get("source", "")):
            priority_items.append(item)
        else:
            secondary_items.append(item)

    # Sort each group by price
    priority_items.sort(key=lambda x: x["eur"])
    secondary_items.sort(key=lambda x: x["eur"])

    # Combine PRIORITY SITES FIRST, then secondary reseller sites
    ordered_sources = priority_items + secondary_items

    # compute most common price cluster
    if ordered_sources:
        sorted_prices = sorted(ordered_sources, key=lambda x: x["eur"])

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

    total = len(ordered_sources)
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
        "sources": ordered_sources,
        "reference_sources": []
    }