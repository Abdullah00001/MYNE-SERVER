import re
import httpx
import asyncio
from app.config import SERPER_API_KEY

SERPER_HEADERS = {
    "X-API-KEY": SERPER_API_KEY,
    "Content-Type": "application/json"
}

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


def to_eur(price: float, symbol: str) -> float:
    """Convert USD or GBP to EUR using approximate rates."""
    rates = {"$": 0.92, "£": 1.17, "€": 1.0}
    return round(price * rates.get(symbol, 1.0), 2)


def parse_prices_from_results(results: list, min_price: float = 500) -> list[float]:
    """
    Extract and convert prices from Serper organic/shopping results.
    Returns a clean list of EUR floats above min_price.
    """
    prices = []
    for item in results:
        # Shopping results have a 'price' field
        raw = item.get("price", "")

        # Organic results → scan title + snippet
        if not raw:
            text = f"{item.get('title', '')} {item.get('snippet', '')}"
            matches = re.findall(r'([\$£€])\s*([\d,]+\.?\d*)', text)
            for symbol, amount in matches:
                price = extract_price(amount)
                if price and price > min_price:
                    prices.append(to_eur(price, symbol))
                    break  # one price per result
            continue

        price = extract_price(raw)
        if price and price > min_price:
            symbol = raw.strip()[0] if raw.strip() and raw.strip()[
                0] in "$£€" else "€"
            prices.append(to_eur(price, symbol))

    return prices


def remove_outliers(prices: list[float]) -> list[float]:
    """
    Remove statistical outliers using the IQR method.
    Keeps prices within 1.5x the interquartile range.
    """
    if len(prices) < 4:
        return prices  # not enough data to remove outliers safely

    sorted_p = sorted(prices)
    n = len(sorted_p)
    q1 = sorted_p[n // 4]
    q3 = sorted_p[(3 * n) // 4]
    iqr = q3 - q1

    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr

    filtered = [p for p in prices if lower <= p <= upper]
    # fallback: return original if all removed
    return filtered if filtered else prices


def weighted_median(retail: list, reseller: list, ebay: list) -> float:
    """
    Combine prices from 3 sources using weighted sampling.
    Weights: eBay listed 50%, Resellers 35%, Retail 15%
    Returns the median of the combined weighted pool.
    """
    pool = []
    pool += reseller * 35  # reseller weight
    pool += ebay * 50      # ebay listed weight
    pool += retail * 15    # retail/new weight

    if not pool:
        return 0.0

    pool.sort()
    mid = len(pool) // 2
    if len(pool) % 2 == 0:
        return (pool[mid - 1] + pool[mid]) / 2
    return pool[mid]


# ─────────────────────────────────────────
# FETCHERS
# ─────────────────────────────────────────

async def fetch_retail_prices(brand: str, model: str, size: str, leather: str, color: str) -> list[float]:
    """
    Fetch NEW / retail prices via Google Shopping.
    Targets brand boutiques and authorized retailers.
    """
    query = f"{brand} {model} {size} {leather} {color} new buy"
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
        return remove_outliers(prices)

    except Exception as e:
        print(f"[fetch_retail_prices] failed: {e}")
        return []


async def fetch_reseller_prices(brand: str, model: str, size: str, leather: str, color: str) -> list[float]:
    """
    Fetch RESALE prices from luxury reseller platforms via two Serper organic searches.
    Splits into two queries to avoid Google truncating long OR chains.
    """
    base = f"{brand} {model} {size} {leather} {color}"

    query_1 = f"{base} site:vestiaire.com OR site:therealreal.com OR site:1stdibs.com"
    query_2 = f"{base} site:fashionphile.com OR site:rebag.com OR site:collectorsquare.com OR site:labellov.com"

    async def search(q: str) -> list:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://google.serper.dev/search",
                headers=SERPER_HEADERS,
                json={"q": q, "num": 10}
            )
            res.raise_for_status()
            return res.json().get("organic", [])

    try:
        results_1, results_2 = await asyncio.gather(search(query_1), search(query_2))
        all_results = results_1 + results_2
        prices = parse_prices_from_results(all_results, min_price=500)
        return remove_outliers(prices)

    except Exception as e:
        print(f"[fetch_reseller_prices] failed: {e}")
        return []


async def fetch_ebay_listings(brand: str, model: str, size: str, leather: str, color: str) -> list[float]:
    """
    Fetch eBay active listings via Serper Google Shopping.
    We label these separately from resellers because they include non-authenticated sellers.
    """
    query = f"{brand} {model} {size} {leather} {color} site:ebay.com"
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
    color: str
) -> dict:
    """
    Fetches prices from all 3 sources concurrently.
    Returns a dict with raw prices per source and a combined weighted price.
    """
    retail, reseller, ebay = await asyncio.gather(
        fetch_retail_prices(brand, model, size, leather, color),
        fetch_reseller_prices(brand, model, size, leather, color),
        fetch_ebay_listings(brand, model, size, leather, color),
    )

    combined = weighted_median(retail, reseller, ebay)
    total_points = len(retail) + len(reseller) + len(ebay)

    return {
        "retail_prices": retail,
        "reseller_prices": reseller,
        "ebay_prices": ebay,
        "weighted_price": round(combined, 2),
        "data_points": total_points,
        # If we have fewer than 4 real data points, GPT should take over
        "needs_gpt_fallback": total_points < 4
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
