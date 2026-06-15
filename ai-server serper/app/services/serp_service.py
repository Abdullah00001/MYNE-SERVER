import re
import httpx
import asyncio
from app.config import SERP_API_KEY, OPENAI_API_KEY
from app.services.brand_config import get_official_site, get_brand_config


SERP_HEADERS = {
    "X-API-KEY": SERP_API_KEY,
    "Content-Type": "application/json"
}


# ─────────────────────────────────────────
# UTILITIES
# ─────────────────────────────────────────


def extract_price(text) -> float | None:
    """Only extract a number if it's directly attached to a currency symbol."""
    if not text:
        return None
    # Handle if Serper returns a number directly
    if isinstance(text, (int, float)):
        return float(text)
    match = re.search(
        r'[\$£€¥]\s*([\d]{1,3}(?:[,.][\d]{3})*(?:\.\d{1,2})?)', text)
    if not match:
        return None
    try:
        return float(match.group(1).replace(",", ""))
    except Exception:
        return None


def detect_currency_symbol(text) -> str:
    if text is None:
        return "€"

    text = str(text)  # 🔥 normalize everything to string

    if "$" in text or "USD" in text:
        return "$"
    if "£" in text or "GBP" in text:
        return "£"
    if "€" in text or "EUR" in text:
        return "€"
    if "¥" in text or "JPY" in text or "CNY" in text:
        return "¥"

    return "€"

# ─────────────────────────────────────────
# LIVE EXCHANGE RATES
# ─────────────────────────────────────────


_rate_cache = {
    # fallback defaults
    "rates": {"USD": 0.92, "GBP": 1.17, "JPY": 0.0062, "CNY": 0.13},
    "last_updated": None
}


def format_colors(color) -> str:
    """Handle both string and list color inputs."""
    if isinstance(color, list):
        return " ".join(color)
    return color or ""


async def refresh_rates():
    """Fetch live rates from frankfurter.app. Refreshes every 24 hours."""
    from datetime import datetime, timedelta

    now = datetime.utcnow()
    last = _rate_cache["last_updated"]

    # Skip if cache is fresh (less than 24 hours old)
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

        # frankfurter returns EUR→X rates, we need X→EUR so we invert
        for currency, rate in data["rates"].items():
            _rate_cache["rates"][currency] = round(1 / rate, 6)

        _rate_cache["last_updated"] = now
        print(f"[rates] Refreshed: {_rate_cache['rates']}")

    except Exception as e:
        print(f"[rates] Failed to refresh, using cached rates: {e}")


def to_eur(price: float, symbol: str) -> float:
    """Convert any currency to EUR using live cached rates."""
    symbol_to_currency = {
        "$": "USD",
        "£": "GBP",
        "€": "EUR",
        "¥": "JPY",
        "¥CN": "CNY",
    }
    currency = symbol_to_currency.get(symbol, "EUR")
    if currency == "EUR":
        return round(price, 2)
    rate = _rate_cache["rates"].get(currency, 1.0)
    return round(price * rate, 2)


def parse_prices_from_results(results: list, min_price: float = 500) -> list[dict]:
    prices = []
    for item in results:
        raw = str(item.get("price", ""))

        merchant = item.get("source", "").strip()
        link = item.get("productLink") or item.get("link", "")

        if not merchant:
            domain_match = re.search(r'(?:https?://)?(?:www\.)?([^/]+)', link)
            merchant = domain_match.group(1) if domain_match else "unknown"

        if not raw:
            text = f"{item.get('title', '')} {item.get('snippet', '')}"
            match = re.search(
                r'([\$£€¥])\s*([\d]{1,3}(?:[,.][\d]{3})*(?:\.\d{1,2})?)', text)
            if match:
                symbol = match.group(1)
                price = float(match.group(2).replace(",", ""))
                if price > min_price:
                    eur = to_eur(price, symbol)
                    prices.append({"eur": eur, "original": price,
                                   "currency": symbol, "source": normalize_source(merchant), "url": link})
            continue

        EXCLUDE_RETAIL_SITES = [
            "farfetch.com", "mytheresa.com", "net-a-porter.com", "matches.com"]
        if any(site in normalize_source(merchant) for site in EXCLUDE_RETAIL_SITES):
            continue

        price = extract_price(raw)
        if price and price > min_price:
            symbol = detect_currency_symbol(raw)
            eur = to_eur(price, symbol)
            prices.append({"eur": eur, "original": price,
                          "currency": symbol, "source": normalize_source(merchant), "url": link})

    return prices


def deduplicate_by_domain(prices: list[dict]) -> list[dict]:
    seen = {}
    for p in prices:
        domain = normalize_source(p["source"])
        if domain not in seen or p["eur"] > seen[domain]["eur"]:
            seen[domain] = p
    return list(seen.values())


def normalize_source(source: str) -> str:
    """Convert merchant names to their domain for consistent deduplication."""
    # If it already looks like a domain, return as-is
    if "." in source:
        return source.lower()
    # Otherwise slugify: lowercase, replace spaces with nothing
    return source.lower().replace(" ", "").replace("'", "") + ".com"


def remove_outliers(prices: list[dict]) -> list[dict]:
    """
    Remove statistical outliers using the IQR method.
    Works on list of price dicts.
    """
    if len(prices) < 6:
        return prices

    values = [p["eur"] for p in prices]
    sorted_v = sorted(values)
    n = len(sorted_v)
    q1 = sorted_v[n // 4]
    q3 = sorted_v[(3 * n) // 4]
    iqr = q3 - q1

    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr

    filtered = [p for p in prices if lower <= p["eur"] <= upper]
    return filtered if filtered else prices


# ─────────────────────────────────────────
# FETCHERS
# ─────────────────────────────────────────
async def scrape_page_text(client: httpx.AsyncClient, url: str) -> dict | None:
    try:
        page = await asyncio.wait_for(client.get(url, follow_redirects=True), timeout=5.0)
        # Strip HTML tags to get readable text only
        text = re.sub(r'<[^>]+>', ' ', page.text)
        # Collapse whitespace
        text = re.sub(r'\s+', ' ', text).strip()

        text = text.replace('"', "'").replace('\n', ' ').replace('\r', ' ')
        snippet = text[:5000]

        domain = re.search(r'(?:https?://)?(?:www\.)?([^/]+)', url)
        domain = domain.group(1) if domain else "unknown"

        print(f"[scrape_page_text] {domain} → {len(snippet)} chars")
        return {"source": domain, "url": url, "raw_text": snippet}
    except Exception as e:
        print(f"[scrape_page_text] failed {url}: {e}")
    return None


async def fetch_retail_prices(brand: str, model: str, size: str, leather: str, color: str, condition: str, construction: str, special_variant: str, image_search_query: str = "") -> list[float]:
    """
    Fetch retail prices from official brand websites.
    Skips brands with no public pricing (Hermès, Goyard).
    """
    official_site = get_official_site(brand)
    if not official_site:
        print(
            f"[fetch_retail_prices] No public retail prices for {brand} — skipping")
        return []

    # Search Google restricted to official site only
    # query = f"{brand} {model} {size} {leather} {format_colors(color)} buy"
     # Step 1 — find the product page URL via Google
# CORRECT — string in both branches
    query = f"{image_search_query} site:{official_site}" if image_search_query else f"{brand} {model} {size} {leather} {format_colors(color)} buy site:{official_site}"

    print(f"[fetch_retail_prices] query: {query}")

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://google.serper.dev/search",
                headers=SERP_HEADERS,
                json={"q": query, "num": 5}
            )
            data = res.json()

        prices = parse_prices_from_results(
            data.get("organic", []), min_price=500)
        print(
            f"[fetch_retail_prices] {brand} → found {len(prices)} prices from snippet")
        return prices
    except Exception as e:
        print(f"[fetch_retail_prices] Failed: {e}")
        return []


async def ai_extract_price_from_page(page_text: str, image_search_query: str) -> dict | None:
    """
    Ask AI to extract the price for our specific bag from scraped page text.
    Returns {"symbol": "€", "price": 8500.0} or None if not found.
    """
    prompt = f"""You are a luxury bag pricing expert.

Target bag: "{image_search_query}"

Below is scraped text from a reseller product page.
Find the price of this EXACT bag on this page.
Reply with ONLY the price in this format: SYMBOL AMOUNT (e.g. "$ 8500" or "€ 12000")
If the page does not contain a price for this exact bag, reply with "none".

Page text:
{page_text[:5000]}"""

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}",
                         "Content-Type": "application/json"},
                json={"model": "gpt-4o-mini",
                      "messages": [{"role": "user", "content": prompt}], "max_tokens": 20}
            )
            result = res.json()["choices"][0]["message"]["content"].strip()
            print(f"[ai_extract_price] result: {result}")

            if result.lower() == "none":
                return None

            match = re.search(
                r'([\$£€¥])\s*([\d]{1,3}(?:[,.][\d]{3})*(?:\.\d{1,2})?)', result)
            if match:
                return {"symbol": match.group(1), "price": float(match.group(2).replace(",", ""))}
    except Exception as e:
        print(f"[ai_extract_price] failed: {e}")
    return None


async def ai_filter_titles(items: list, image_search_query: str) -> list:
    """Use OpenAI to filter shopping results to only exact bag matches."""
    if not items:
        return []

    titles = [f"{i}: {item.get('title', '')}" for i, item in enumerate(items)]
    titles_text = "\n".join(titles)

    prompt = f"""You are a luxury bag expert.
Target bag: "{image_search_query}"

Below are search result titles numbered 0 to {len(items)-1}.
Return ONLY the numbers of listings that are for the EXACT same bag (same model, size, leather, color).
Ignore guides, articles, category pages, or different variants.
Reply with only comma-separated numbers, nothing else. If none match, reply with "none".

Titles:
{titles_text}"""

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}",
                         "Content-Type": "application/json"},
                json={"model": "gpt-4o-mini",
                      "messages": [{"role": "user", "content": prompt}], "max_tokens": 100}
            )
            result = res.json()["choices"][0]["message"]["content"].strip()
            print(f"[ai_filter] AI selected: {result}")
            if result.lower() == "none":
                return []
            indices = [int(x.strip())
                       for x in result.split(",") if x.strip().isdigit()]
            return [items[i] for i in indices if i < len(items)]
    except Exception as e:
        print(f"[ai_filter] failed: {e} — returning all")
        return items


async def fetch_reseller_prices(brand: str, model: str, size: str, leather: str, color: str, condition: str, construction: str, special_variant: str, image_search_query: str = "") -> list[dict]:
    color_str = format_colors(color)
    base = image_search_query if image_search_query else f"{brand} {model} {size} {color_str} {leather} {construction} {special_variant}".strip(
    )

    config = get_brand_config(brand)
    min_price = config.get("min_resale_price", 300)

    print(f"[fetch_reseller_prices] base query: {base}")

    # ── Query 1: Shopping endpoint — always has clean price field ──
    async def search_shopping(q: str) -> list:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                res = await client.post(
                    "https://google.serper.dev/shopping",
                    headers=SERP_HEADERS,
                    json={"q": q, "num": 20}
                )
                res.raise_for_status()
                results = res.json().get("shopping", [])
                for item in results[:5]:
                    print(
                        f"[raw shopping item] source={item.get('source')} | price={item.get('price')} | link={item.get('link', '')[:60]} | productLink={item.get('productLink', 'MISSING')[:80]}"
                    )
                return results  # ← this was missing
        except Exception as e:
            print(f"[fetch_reseller_prices] shopping failed: {e}")
            return []

    # ── Query 2: Organic — for sites not in shopping index ──
    async def search_organic(q: str) -> list:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                res = await client.post(
                    "https://google.serper.dev/search",
                    headers=SERP_HEADERS,
                    json={"q": q, "num": 10}
                )
                res.raise_for_status()
                return res.json().get("organic", [])
        except Exception as e:
            print(f"[fetch_reseller_prices] organic failed: {e}")
            return []

    # Run shopping + organic in parallel
    shopping_results, organic_results = await asyncio.gather(
        search_shopping(image_search_query if image_search_query else base),
        search_organic(f"{image_search_query if image_search_query else base} site:jewelsaficionado.com OR site:sellierknightsbridge.com OR site:priveporter.com OR site:mightychic.com OR site:theluxurycloset.com OR site:fashionphile.com OR site:vestiaire.com OR site:therealreal.com OR site:1stdibs.com OR site:rebag.com OR site:madisonavenuecouture.com OR site:baghunter.com OR site:collector-square.com OR site:sothebys.com OR site:christies.com OR site:bonhams.com OR site:saclab.com OR site:Loveluxury.com"),
    )

    shopping_results = await ai_filter_titles(shopping_results, image_search_query)

    print(
        f"[filter] {len(shopping_results)} shopping / {len(organic_results)} organic after title match")

    # Parse prices from both
    shopping_prices = parse_prices_from_results(
        shopping_results, min_price=min_price)
    # Scrape organic result pages directly for accurate prices
    organic_prices = []
    async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }) as client:
        tasks = [scrape_page_text(client, item.get("link", ""))
                 for item in organic_results if item.get("link")]
        pages = await asyncio.gather(*tasks)
        valid_pages = [p for p in pages if p]
        ai_tasks = [ai_extract_price_from_page(
            p["raw_text"], image_search_query) for p in valid_pages]
        ai_results = await asyncio.gather(*ai_tasks)

        for page, extracted in zip(valid_pages, ai_results):
            if not extracted:
                continue
            symbol = extracted["symbol"]
            price = extracted["price"]
            if price > min_price:
                eur = to_eur(price, symbol)
                organic_prices.append(
                    {"eur": eur, "original": price, "currency": symbol, "source": page["source"], "url": page["url"]})
    # Log what we found
    # Fallback — snippet prices from organic results
    snippet_prices = parse_prices_from_results(
        organic_results, min_price=min_price)
    print(f"[organic snippets] found {len(snippet_prices)} snippet prices")
    organic_prices = organic_prices + snippet_prices

    # Log what we found
    for p in shopping_prices:
        print(
            f"[shopping] {p['source']} → {p['currency']}{p['original']} = €{p['eur']}")
    for p in organic_prices:
        print(
            f"[organic] {p['source']} → {p['currency']}{p['original']} = €{p['eur']}")

    # Merge, deduplicate, remove outliers
    all_prices = shopping_prices + organic_prices
    print(
        f"[debug] before dedup: {[(p['source'], p['eur']) for p in all_prices]}")
    all_prices = deduplicate_by_domain(all_prices)
    all_prices = remove_outliers(all_prices)

    print(
        f"[fetch_reseller_prices] → {len(all_prices)} clean prices: {all_prices}")
    return all_prices


async def fetch_ebay_listings(brand: str, model: str, size: str, leather: str, color: str, condition: str, construction: str, special_variant: str, image_search_query: str = "") -> list[float]:
    """
    Fetch eBay active listings via Serper Google Shopping.
    We label these separately from resellers because they include non-authenticated sellers.
    """
    base = image_search_query if image_search_query else f"{brand} {model} {size} {leather} {format_colors(color)}"
    query = f"{base} site:ebay.com"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://google.serper.dev/shopping",
                headers=SERP_HEADERS,
                json={"q": query, "num": 10}
            )
            res.raise_for_status()
            data = res.json()

        shopping_results = data.get("shopping", [])
        shopping_results = await ai_filter_titles(shopping_results, image_search_query)

        prices = parse_prices_from_results(
            shopping_results, min_price=800)
        prices = remove_outliers(prices)
        print(
            f"[debug] before dedup: {[(p['source'], p['eur']) for p in prices]}")
        return deduplicate_by_domain(prices)   # ← add this

    except Exception as e:
        print(f"[fetch_ebay_listings] failed: {e}")
        return []


# ─────────────────────────────────────────
# MAIN ENTRY — fetch all sources at once
# ─────────────────────────────────────────

async def fetch_all_market_prices(
    brand: str,
    model: str,
    size: str,
    leather: str,
    color: str,
    condition: str,
    construction: str,
    special_variant: str,
    image_search_query: str = "",
) -> dict:
    await refresh_rates()

    retail, reseller, ebay = await asyncio.gather(
        fetch_retail_prices(brand, model, size, leather,
                            color, condition, construction, special_variant, image_search_query),
        fetch_reseller_prices(brand, model, size, leather,
                              color, condition, construction, special_variant, image_search_query),
        fetch_ebay_listings(brand, model, size, leather,
                            color, condition, construction, special_variant, image_search_query),
    )

    # Compute retail median
    retail_sorted = sorted(retail, key=lambda x: x["eur"])
    retail_price = round(
        retail_sorted[len(retail_sorted) // 2]["eur"], 2) if retail_sorted else None

# Resellers 2x weighted over eBay
    pool = reseller + reseller + ebay
    if pool:
        pool_sorted = sorted(pool, key=lambda x: x["eur"])
        n = len(pool_sorted)
        resale_price = round(
            (pool_sorted[n//2-1]["eur"] + pool_sorted[n//2]["eur"]) / 2, 2
        ) if n % 2 == 0 else round(pool_sorted[n//2]["eur"], 2)
    else:
        resale_price = None

    total_points = len(retail) + len(reseller) + len(ebay)

    total_points = len(retail) + len(reseller) + len(ebay)

    if total_points < 3:
        valuation_status = "Not enough data for precise valuation"
    elif total_points < 6:
        valuation_status = "Limited data — estimate may vary"
    else:
        valuation_status = "Good data — high confidence"

    def summarize(price_list: list[dict]) -> list[dict]:
        return [
            {
                "source": p["source"],
                "url": p.get("url", ""),   # ← add this
                "price_eur": p["eur"],
                "original_price": p["original"],
                "currency": p["currency"]
            }
            for p in price_list
        ]

    print(
        f"[fetch_all_market_prices] retail={retail_price} | resale={resale_price} | points={total_points}")

    return {
        "retail_price": retail_price,
        "resale_price": resale_price,
        "data_points": total_points,
        "valuation_status": valuation_status,
        "needs_gpt_fallback": total_points < 3,
        "retail_sources": summarize(retail),
        "reseller_sources": summarize(reseller),  # ← fixed
        "ebay_sources": summarize(ebay),
        "reseller_raw_pages": [],                 # ← no longer used
    }
# ─────────────────────────────────────────
# IMAGE FETCH (unchanged, kept for reuse)
# ─────────────────────────────────────────


# async def fetch_bag_image(query: str) -> dict:
#     try:
#         async with httpx.AsyncClient(timeout=20) as client:
#             res = await client.post(
#                 "https://google.serper.dev/images",
#                 headers=SERPER_HEADERS,
#                 json={"q": query}
#             )
#             res.raise_for_status()
#             data = res.json()

#         for result in data.get("images", []):
#             thumbnail = result.get("thumbnailUrl", "")
#             image = result.get("imageUrl", "")
#             if thumbnail or image:
#                 return {"thumbnailUrl": thumbnail, "imageUrl": image}

#         return {"thumbnailUrl": "", "imageUrl": ""}

#     except Exception as e:
#         print(f"[fetch_bag_image] failed: {e}")
#         return {"thumbnailUrl": "", "imageUrl": ""}


# async def fetch_bag_image(query: str) -> dict:
#     # All luxury resale + auction sites for clean product images
#     site_filter = " OR ".join([
#         "site:vestiaire.com",
#         "site:therealreal.com",
#         "site:1stdibs.com",
#         "site:rebag.com",
#         "site:fashionphile.com",
#         "site:madisonavenuecouture.com",
#         "site:baghunter.com",
#         "site:collector-square.com",
#         "site:sothebys.com",
#         "site:christies.com",
#         "site:bonhams.com",
#         "site:labellov.com",
#         "site:saclab.com",
#         "site:privéporter.com",
#         "site:xupes.com",
#         "site:ginzaxiaoma.com",
#         "site:jewelsaficionado.com",
#         "site:mightychic.com",
#         "site:theluxurycloset.com",
#     ])
#     refined_query = f"{query} {site_filter}"

#     try:
#         # First attempt — trusted luxury sites only
#         async with httpx.AsyncClient(timeout=20) as client:
#             res = await client.post(
#                 "https://google.serper.dev/images",
#                 headers=SERPER_HEADERS,
#                 json={"q": refined_query, "num": 5}
#             )
#             res.raise_for_status()
#             data = res.json()

#         for result in data.get("images", []):
#             thumbnail = result.get("thumbnailUrl", "")
#             image = result.get("imageUrl", "")
#             if thumbnail or image:
#                 print(
#                     f"[fetch_bag_image] Found image from: {result.get('domain', 'unknown')}")
#                 return {"thumbnailUrl": thumbnail, "imageUrl": image}

#         # Fallback — open search if nothing found
#         print(f"[fetch_bag_image] No results from luxury sites, trying open search")
#         async with httpx.AsyncClient(timeout=20) as client:
#             res = await client.post(
#                 "https://google.serper.dev/images",
#                 headers=SERPER_HEADERS,
#                 json={"q": query, "num": 5}
#             )
#             res.raise_for_status()
#             data = res.json()

#         for result in data.get("images", []):
#             thumbnail = result.get("thumbnailUrl", "")
#             image = result.get("imageUrl", "")
#             if thumbnail or image:
#                 return {"thumbnailUrl": thumbnail, "imageUrl": image}

#         return {"thumbnailUrl": "", "imageUrl": ""}

#     except Exception as e:
#         print(f"[fetch_bag_image] failed: {e}")
#         return {"thumbnailUrl": "", "imageUrl": ""}


LUXURY_SITES_PRIMARY = (
    "site:vestiaire.com OR site:1stdibs.com OR site:therealreal.com "
    "OR site:fashionphile.com OR site:rebag.com"
)

LUXURY_SITES_SECONDARY = (
    "site:madisonavenuecouture.com OR site:sothebys.com "
    "OR site:priveporter.com OR site:wararni.com "
    "OR site:janefinds.com OR site:collector-square.com"
)

BLOCKED_DOMAINS = [
    "instagram.com", "lookaside.instagram.com", "pinterest.com",
    "tiktok.com", "facebook.com", "twitter.com", "reddit.com",
    "encrypted-tbn", "serpapi.com",
    "wikimedia.org", "wikipedia.org",  # encyclopedia images
    "blogspot.com", "wordpress.com",   # blogs
    "aliexpress.com", "dhgate.com",    # fakes
]


def is_clean_url(url: str) -> bool:
    return url and not any(blocked in url for blocked in BLOCKED_DOMAINS)


async def fetch_bag_image(query: str) -> dict:
    import time
    t0 = time.time()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(
                "https://serpapi.com/search",
                params={
                    "engine": "google_images",
                    "q": f"{query} {LUXURY_SITES_PRIMARY}",
                    "num": 5,
                    "tbs": "itp:photo",
                    "api_key": SERP_API_KEY,
                }
            )
            res.raise_for_status()
            data = res.json()
        t1 = time.time()
        print(f"[T] fetch_bag_image luxury={t1-t0:.2f}s | query={query[:50]}")

        for result in data.get("images_results", []):
            original = result.get("original", "")
            thumbnail = result.get("thumbnail", "")
            if is_clean_url(original):
                clean_thumb = thumbnail if is_clean_url(
                    thumbnail) else original
                print(f"[T] fetch_bag_image DONE={t1-t0:.2f}s (luxury hit)")
                return {"thumbnailUrl": clean_thumb, "imageUrl": original}

        # Fallback
        async with httpx.AsyncClient(timeout=6) as client:
            res = await client.get(
                "https://serpapi.com/search",
                params={
                    "engine": "google_images",
                    "q": query,
                    "num": 10,
                    "tbs": "itp:photo",
                    "api_key": SERP_API_KEY,
                }
            )
            res.raise_for_status()
            data = res.json()
        t2 = time.time()
        print(f"[T] fetch_bag_image fallback={t2-t1:.2f}s total={t2-t0:.2f}s")

        for result in data.get("images_results", []):
            original = result.get("original", "")
            thumbnail = result.get("thumbnail", "")
            if is_clean_url(original):
                return {"thumbnailUrl": thumbnail, "imageUrl": original}

        return {"thumbnailUrl": "", "imageUrl": ""}

    except Exception as e:
        print(f"[fetch_bag_image] failed after {time.time()-t0:.2f}s: {e}")
        return {"thumbnailUrl": "", "imageUrl": ""}
