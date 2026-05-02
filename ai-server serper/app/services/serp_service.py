
import re
import httpx
import asyncio
from app.config import SERPER_API_KEY

SERPER_HEADERS = {
    "X-API-KEY": SERPER_API_KEY,
    "Content-Type": "application/json"
}

# ─────────────────────────────────────────
# BRAND CONFIG
# ─────────────────────────────────────────

BRAND_OFFICIAL_SITES = {
    "louis vuitton": "louisvuitton.com",
    "gucci": "gucci.com",
    "prada": "prada.com",
    "bottega veneta": "bottegaveneta.com",
    "saint laurent": "ysl.com",
    "celine": "celine.com",
    "loewe": "loewe.com",
    "fendi": "fendi.com",
    "balenciaga": "balenciaga.com",
    "burberry": "burberry.com",
    "valentino": "valentino.com",
    "miu miu": "miumiu.com",
    "dior": "dior.com",
    "givenchy": "givenchy.com",
    "chanel": "chanel.com",
}

# These brands have NO public retail prices — skip to resale only
NO_RETAIL_BRANDS = {"hermès", "hermes", "goyard", "moynat"}

# ─────────────────────────────────────────
# UTILITIES
# ─────────────────────────────────────────


def extract_price(text: str) -> float | None:
    """Extract first clean number from a price string like '$9,200' or '€ 8.500'."""
    if not text:
        return None
    try:
        cleaned = text.replace(",", "").replace(".", "")
        # Handle European formatting: 8.500 → 8500, but 8,500.00 → 850000 (wrong)
        # Safer: just grab all digits with optional single decimal
        match = re.search(r'[\d]+(?:[.,]\d{1,2})?', text.replace(",", ""))
        if match:
            return float(match.group().replace(",", "."))
    except Exception:
        return None


def detect_currency_symbol(text: str) -> str:
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
                "https://api.frankfurter.app/latest",
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
    """
    Extract and convert prices from Serper organic/shopping results.
    Returns a list of dicts with price, source, original currency.
    """
    prices = []
    for item in results:
        raw = item.get("price", "")
        source = item.get("link", "") or item.get("source", "")

        # Extract domain from URL
        domain = re.search(r'(?:https?://)?(?:www\.)?([^/]+)', source)
        domain = domain.group(1) if domain else "unknown"

        # Organic results → scan title + snippet
        if not raw:
            text = f"{item.get('title', '')} {item.get('snippet', '')}"
            matches = re.findall(r'([\$£€¥])\s*([\d,]+\.?\d*)', text)
            for symbol, amount in matches:
                price = extract_price(amount)
                if price and price > min_price:
                    eur = to_eur(price, symbol)
                    prices.append({
                        "eur": eur,
                        "original": price,
                        "currency": symbol,
                        "source": domain
                    })
                    break
            continue

        price = extract_price(raw)
        if price and price > min_price:
            symbol = detect_currency_symbol(raw)
            eur = to_eur(price, symbol)
            prices.append({
                "eur": eur,
                "original": price,
                "currency": symbol,
                "source": domain
            })

    return prices


def remove_outliers(prices: list[dict]) -> list[dict]:
    """
    Remove statistical outliers using the IQR method.
    Works on list of price dicts.
    """
    if len(prices) < 4:
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


# def weighted_median(retail: list, reseller: list, ebay: list) -> float:
#     """
#     Combine prices from 3 sources using weighted sampling.
#     Weights: eBay listed 50%, Resellers 35%, Retail 15%
#     Returns the median of the combined weighted pool.
#     """
#     pool = []
#     pool += reseller * 35  # reseller weight
#     pool += ebay * 50      # ebay listed weight
#     pool += retail * 15    # retail/new weight

#     if not pool:
#         return 0.0

#     pool.sort()
#     mid = len(pool) // 2
#     if len(pool) % 2 == 0:
#         return (pool[mid - 1] + pool[mid]) / 2
#     return pool[mid]


# ─────────────────────────────────────────
# FETCHERS
# ─────────────────────────────────────────

async def fetch_retail_prices(brand: str, model: str, size: str, leather: str, color: str, condition: str, construction: str, special_variant: str) -> list[float]:
    """
    Fetch retail prices from official brand websites.
    Skips brands with no public pricing (Hermès, Goyard).
    """
    brand_lower = brand.lower()

    # Skip retail fetch for brands with no public prices
    if brand_lower in NO_RETAIL_BRANDS:
        print(
            f"[fetch_retail_prices] Skipping {brand} — no public retail prices")
        return []

    # Get official site for this brand
    official_site = BRAND_OFFICIAL_SITES.get(brand_lower)
    if not official_site:
        print(f"[fetch_retail_prices] No official site mapped for {brand}")
        return []

    # Search Google restricted to official site only
    query = f"{brand} {model} {size} {leather} {color} site:{official_site}"

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://google.serper.dev/shopping",
                headers=SERPER_HEADERS,
                json={"q": query, "num": 10}
            )
            res.raise_for_status()
            data = res.json()

        prices = parse_prices_from_results(
            data.get("shopping", []), min_price=500)

        print(
            f"[fetch_retail_prices] {brand} → {official_site} → found {len(prices)} prices: {prices}")
        return remove_outliers(prices)

    except Exception as e:
        print(f"[fetch_retail_prices] failed: {e}")
        return []


async def fetch_reseller_prices(brand: str, model: str, size: str, leather: str, color: str, condition: str, construction: str, special_variant: str) -> list[float]:
    """
    Fetch resale prices from luxury resale platforms.
    Used for ALL brands including Hermès and Goyard.
    """
    base = f"{brand} {model} {size} {leather} {color}"
    if construction:
        base += f" {construction}"
    if special_variant and special_variant != "Standard":
        base += f" {special_variant}"

        # Split into 3 queries to cover all sites without truncation
    query_1 = f"{base} site:vestiaire.com OR site:therealreal.com OR site:1stdibs.com"
    query_2 = f"{base} site:rebag.com OR site:fashionphile.com OR site:madisonavenuecouture.com"
    query_3 = f"{base} site:sothebys.com OR site:saclab.com OR site:ginzaxiaoma.com OR site:labellov.com"
    query_4 = f"{base} site:baghunter.com OR site:collector-square.com OR site:privéporter.com"

    async def search(q: str) -> list:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                res = await client.post(
                    "https://google.serper.dev/search",
                    headers=SERPER_HEADERS,
                    json={"q": q, "num": 10}
                )
                res.raise_for_status()
                return res.json().get("organic", [])
        except Exception as e:
            print(f"[fetch_reseller_prices] query failed: {e}")
            return []

    results_1, results_2, results_3, results_4 = await asyncio.gather(
        search(query_1), search(query_2), search(query_3), search(query_4)
    )

    all_results = results_1 + results_2 + results_3 + results_4
    prices = parse_prices_from_results(all_results, min_price=500)

    print(
        f"[fetch_reseller_prices] {brand} {model} → found {len(prices)} prices: {prices}")
    return remove_outliers(prices)


async def fetch_ebay_listings(brand: str, model: str, size: str, leather: str, color: str, condition: str, construction: str, special_variant: str) -> list[float]:
    """
    Fetch eBay active listings via Serper Google Shopping.
    We label these separately from resellers because they include non-authenticated sellers.
    """
    query = f"{brand} {model} {size} {leather} {color} {condition} {construction}  site:ebay.com"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://google.serper.dev/shopping",
                headers=SERPER_HEADERS,
                json={"q": query, "num": 10}
            )
            res.raise_for_status()
            data = res.json()

        prices = parse_prices_from_results(
            data.get("shopping", []), min_price=800)
        return remove_outliers(prices)

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
    special_variant: str
) -> dict:
    await refresh_rates()

    retail, reseller, ebay = await asyncio.gather(
        fetch_retail_prices(brand, model, size, leather,
                            color, condition, construction, special_variant),
        fetch_reseller_prices(brand, model, size, leather,
                              color, condition, construction, special_variant),
        fetch_ebay_listings(brand, model, size, leather,
                            color, condition, construction, special_variant),
    )

    # Compute retail median
    retail_sorted = sorted(retail, key=lambda x: x["eur"])
    retail_price = round(
        retail_sorted[len(retail_sorted) // 2]["eur"], 2) if retail_sorted else None

    # Compute resale median
    all_resale = reseller + ebay
    all_resale_sorted = sorted(all_resale, key=lambda x: x["eur"])
    resale_price = round(all_resale_sorted[len(
        all_resale_sorted) // 2]["eur"], 2) if all_resale_sorted else None

    total_points = len(retail) + len(reseller) + len(ebay)

    # Valuation status
    if total_points < 3:
        valuation_status = "Not enough data for precise valuation"
    elif total_points < 6:
        valuation_status = "Limited data — estimate may vary"
    else:
        valuation_status = "Good data — high confidence"

    # Build source breakdown
    def summarize(price_list: list[dict]) -> list[dict]:
        return [
            {
                "source": p["source"],
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
        # Source breakdowns for frontend
        "retail_sources": summarize(retail),
        "reseller_sources": summarize(reseller),
        "ebay_sources": summarize(ebay),
        # Raw for debugging
        "retail_prices_raw": [p["eur"] for p in retail],
        "reseller_prices_raw": [p["eur"] for p in reseller],
        "ebay_prices_raw": [p["eur"] for p in ebay],
    }
# ─────────────────────────────────────────
# IMAGE FETCH (unchanged, kept for reuse)
# ─────────────────────────────────────────


async def fetch_bag_image(query: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://google.serper.dev/images",
                headers=SERPER_HEADERS,
                json={"q": query}
            )
            res.raise_for_status()
            data = res.json()

        for result in data.get("images", []):
            thumbnail = result.get("thumbnailUrl", "")
            image = result.get("imageUrl", "")
            if thumbnail or image:
                return {"thumbnailUrl": thumbnail, "imageUrl": image}

        return {"thumbnailUrl": "", "imageUrl": ""}

    except Exception as e:
        print(f"[fetch_bag_image] failed: {e}")
        return {"thumbnailUrl": "", "imageUrl": ""}
