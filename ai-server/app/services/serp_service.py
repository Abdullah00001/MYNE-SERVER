import re
import httpx
from app.config import SERP_API_KEY
from datetime import datetime
from dateutil.relativedelta import relativedelta


def get_last_12_months() -> list:
    months = []
    today = datetime.today()

    for i in range(11, -1, -1):
        d = today - relativedelta(months=i)
        first = d.replace(day=1)
        last = (first + relativedelta(months=1)) - relativedelta(days=1)

        months.append({
            "period": d.strftime("%b %Y"),
            "min": f"{first.month}/{first.day}/{first.year}",
            "max": f"{last.month}/{last.day}/{last.year}"
        })

    return months


def extract_price(price_str: str):
    if not price_str:
        return None
    try:
        match = re.search(r'[\d,]+\.?\d*', price_str.replace(",", ""))
        if match:
            return float(match.group())
    except:
        return None


async def fetch_ebay_prices(query: str) -> list:
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.get(
            "https://serpapi.com/search.json",
            params={
                "engine": "google_shopping",
                "q": query + " ebay",
                "api_key": SERP_API_KEY
            }
        )
        res.raise_for_status()
        data = res.json()

    results = []
    for item in data.get("shopping_results", []):
        price = extract_price(item.get("price"))
        if price and price > 1000:
            results.append({
                "price": price,
                "title": item.get("title", "")[:60],
                "source": "eBay"
            })
    return results


async def fetch_google_shopping_prices(query: str) -> list:
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.get(
            "https://serpapi.com/search.json",
            params={
                "engine": "google_shopping",
                "q": query,
                "api_key": SERP_API_KEY
            }
        )
        res.raise_for_status()
        data = res.json()

    prices = []
    for item in data.get("shopping_results", []):
        price = extract_price(item.get("price"))
        if price:
            prices.append(price)
    return prices


async def fetch_ebay_sold_prices(query: str) -> list:
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.get(
            "https://serpapi.com/search.json",
            params={
                "engine": "ebay",
                "q": query,
                "LH_Sold": "1",
                "LH_Complete": "1",
                "api_key": SERP_API_KEY
            }
        )
        res.raise_for_status()
        data = res.json()

    prices = []
    for item in data.get("organic_results", []):
        price = extract_price(item.get("price", {}).get("raw"))
        if price:
            prices.append(price)
    return prices


async def fetch_google_search_prices(query: str) -> list:
    """Scrapes Vestiaire, Fashionphile, TheRealReal via Google search"""
    search_query = f'{query} site:vestiaire.com OR site:fashionphile.com OR site:therealreal.com OR site:rebag.com OR site:tradesy.com OR site:loveluxury.co.uk OR site:globalboutique.com OR site:sothebys.com'
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.get(
            "https://serpapi.com/search.json",
            params={
                "engine": "google",
                "q": search_query,
                "api_key": SERP_API_KEY
            }
        )
        res.raise_for_status()
        data = res.json()

    prices = []
    for result in data.get("organic_results", []):
        # try to extract price from snippet
        snippet = result.get("snippet", "")
        matches = re.findall(r'\$[\d,]+\.?\d*', snippet)
        for m in matches:
            price = extract_price(m)
            if price and price > 100:  # filter out noise
                prices.append(price)
    return prices


async def fetch_prices_serpapi(query: str) -> list:
    """Fetch prices from all sources and combine"""
    import asyncio

    results = await asyncio.gather(
        fetch_google_shopping_prices(query),
        fetch_ebay_sold_prices(query),
        fetch_google_search_prices(query),
        return_exceptions=True
    )

    all_prices = []
    for r in results:
        if isinstance(r, list):  # skip any failed sources
            all_prices.extend(r)

    return all_prices


async def fetch_bag_image(query: str) -> str:
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.get(
            "https://serpapi.com/search.json",
            params={
                "engine": "google_images",
                "q": query,
                "api_key": SERP_API_KEY
            }
        )
        res.raise_for_status()
        data = res.json()

    results = data.get("images_results", [])
    if results:
        return results[0].get("original", "")
    return ""


async def fetch_comparable_sales(brand: str, model: str, color: str, leather: str, size: str) -> list:
    # very specific query — all details included
    query = f'"{brand} {model}" "{color}" "{leather}" sold price 2025 2026'

    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.get(
            "https://serpapi.com/search.json",
            params={
                "engine": "google",
                "q": query,
                "api_key": SERP_API_KEY
            }
        )
        res.raise_for_status()
        data = res.json()

    sales = []
    for result in data.get("organic_results", [])[:10]:
        snippet = result.get("snippet", "").lower()
        title = result.get("title", "").lower()
        source = result.get("source", "")

        # ← filter: skip if color or leather not mentioned
        if color.lower() not in snippet and color.lower() not in title:
            continue
        if leather.lower() not in snippet and leather.lower() not in title:
            continue

        matches = re.findall(r'[\$£€][\d,]+', snippet)
        for m in matches:
            price = extract_price(m)
            if price and price > 500:
                sales.append({
                    "description": result.get("title", "")[:60],
                    "price": price,
                    "source": source or "Google"
                })
                break

    return sales[:5]


async def fetch_price_history_serp(brand: str, model: str, color: str, leather: str, size: str) -> list:
    import asyncio
    months = get_last_12_months()

    async def fetch_month(m):
        query = f"{brand} {model} {size} {leather} {color} resale price"
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                res = await client.get(
                    "https://serpapi.com/search.json",
                    params={
                        "engine": "google",
                        "q": query,
                        "tbs": f"cdr:1,cd_min:{m['min']},cd_max:{m['max']}",
                        "api_key": SERP_API_KEY
                    }
                )
                res.raise_for_status()
                data = res.json()

            prices = []
            for result in data.get("organic_results", [])[:8]:
                snippet = result.get("snippet", "")
                matches = re.findall(r'[\$£€][\d,]+', snippet)
                for match in matches:
                    price = extract_price(match)
                    if price and price > 1000:
                        prices.append(price)

            if prices:
                avg = sum(prices) / len(prices)
                return {
                    "period": m["period"],
                    "avg_price": round(avg, 2),
                    "sample_count": len(prices),
                    "source": "serp"
                }
            return None
        except:
            return None

    results = await asyncio.gather(*[fetch_month(m) for m in months])
    return [r for r in results if r is not None]
