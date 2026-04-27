import re
import httpx
import asyncio
from app.config import SERPER_API_KEY
from datetime import datetime
from dateutil.relativedelta import relativedelta

SERPER_HEADERS = {"X-API-KEY": SERPER_API_KEY,
                  "Content-Type": "application/json"}


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


def to_eur(price: float, symbol: str) -> float:
    """Convert USD or GBP to EUR."""
    if symbol == "$":
        return round(price * 0.92, 2)
    elif symbol == "£":
        return round(price * 1.17, 2)
    return price  # already EUR


async def fetch_google_shopping_prices(query: str) -> list:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://google.serper.dev/shopping",
                headers=SERPER_HEADERS,
                json={"q": query, "num": 10}
            )
            res.raise_for_status()
            data = res.json()

        prices = []
        for item in data.get("shopping", []):
            raw = item.get("price", "")
            price = extract_price(raw)
            if price and price > 300:
                symbol = raw.strip()[0] if raw.strip() and raw.strip()[
                    0] in "$£€" else "€"
                price = to_eur(price, symbol)
                prices.append(price)
        return prices
    except Exception as e:
        print(f"fetch_google_shopping_prices failed: {e}")
        return []


async def fetch_ebay_prices(query: str) -> list:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://google.serper.dev/shopping",
                headers=SERPER_HEADERS,
                json={"q": query + " ebay", "num": 10}
            )
            res.raise_for_status()
            data = res.json()

        results = []
        for item in data.get("shopping", []):
            raw = item.get("price", "")
            price = extract_price(raw)
            if price and price > 1000:
                symbol = raw.strip()[0] if raw.strip() and raw.strip()[
                    0] in "$£€" else "€"
                price = to_eur(price, symbol)
                results.append({
                    "price": price,
                    "title": item.get("title", "")[:60],
                    "source": "eBay"
                })
        return results
    except Exception as e:
        print(f"fetch_ebay_prices failed: {e}")
        return []


async def fetch_ebay_sold_prices(query: str) -> list:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://google.serper.dev/search",
                headers=SERPER_HEADERS,
                json={"q": query + " ebay sold completed listings", "num": 10}
            )
            res.raise_for_status()
            data = res.json()

        prices = []
        for result in data.get("organic", []):
            snippet = result.get("snippet", "")
            title = result.get("title", "")
            text = f"{title} {snippet}"
            matches = re.findall(r'([\$£€])\s*([\d,]+\.?\d*)', text)
            for symbol, amount in matches:
                price = extract_price(amount)
                if price and price > 800:
                    price = to_eur(price, symbol)
                    prices.append(price)
                    break  # one per result
        return prices
    except Exception as e:
        print(f"fetch_ebay_sold_prices failed: {e}")
        return []


async def fetch_google_search_prices(query: str) -> list:
    try:
        # Split into 2 focused groups — Google truncates long OR chains
        search_query_1 = f'{query} site:vestiaire.com OR site:fashionphile.com OR site:therealreal.com OR site:rebag.com OR site:collectorsquare.com OR site:labellov.com'
        search_query_2 = f'{query} site:loveluxury.co.uk OR site:bagista.co.uk OR site:portero.com OR site:privesale.com OR site:christies.com OR site:sothebys.com'

        async def search(q):
            async with httpx.AsyncClient(timeout=20) as client:
                res = await client.post(
                    "https://google.serper.dev/search",
                    headers=SERPER_HEADERS,
                    json={"q": q, "num": 10}
                )
                res.raise_for_status()
                return res.json().get("organic", [])

        results1, results2 = await asyncio.gather(search(search_query_1), search(search_query_2))
        all_results = results1 + results2

        prices = []
        for result in all_results:
            snippet = result.get("snippet", "")
            title = result.get("title", "")
            text = f"{title} {snippet}"
            matches = re.findall(r'([\$£€])\s*([\d,]+\.?\d*)', text)
            for symbol, amount in matches:
                price = extract_price(amount)
                if price and price > 500:
                    price = to_eur(price, symbol)
                    prices.append(price)
                    break  # one per result

        return prices
    except Exception as e:
        print(f"fetch_google_search_prices failed: {e}")
        return []


async def fetch_prices_serpapi(query: str) -> list:
    all_prices = []
    for fn in [fetch_google_shopping_prices, fetch_ebay_sold_prices, fetch_google_search_prices]:
        try:
            prices = await fn(query)
            all_prices.extend(prices)
        except:
            continue
    return all_prices


async def fetch_bag_image(query: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://google.serper.dev/images",
                headers=SERPER_HEADERS,
                json={"q": query}
            )
            res.raise_for_status()
            data = res.json()

        results = data.get("images", [])
        for result in results:
            thumbnail = result.get("thumbnailUrl", "")
            image = result.get("imageUrl", "")
            if thumbnail or image:
                return {
                    "thumbnailUrl": thumbnail,
                    "imageUrl": image
                }
        return {"thumbnailUrl": "", "imageUrl": ""}
    except Exception as e:
        print(f"fetch_bag_image failed: {e}")
        return {"thumbnailUrl": "", "imageUrl": ""}  # consistent on error too


async def fetch_comparable_sales(brand: str, model: str, color: str, leather: str, size: str) -> list:
    try:
        query = f'{brand} {model} {size} {color} {leather} sold price 2025 2026'
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://google.serper.dev/search",
                headers=SERPER_HEADERS,
                json={"q": query, "num": 10}
            )
            res.raise_for_status()
            data = res.json()

        sales = []
        floor = 3000 if brand.lower() in ["hermès", "hermes"] else 500

        for result in data.get("organic", [])[:10]:
            snippet = result.get("snippet", "").lower()
            title = result.get("title", "").lower()
            source = result.get("source", "")

            # only color filter — leather was too strict and killed most results
            if color.lower() not in snippet and color.lower() not in title:
                continue

            text = f"{title} {snippet}"
            matches = re.findall(r'([\$£€])\s*([\d,]+\.?\d*)', text)
            for symbol, amount in matches:
                price = extract_price(amount)
                if price and price > floor:
                    price = to_eur(price, symbol)
                    sales.append({
                        "description": result.get("title", "")[:60],
                        "price": price,
                        "source": source or "Google"
                    })
                    break

        return sales[:5]
    except Exception as e:
        print(f"fetch_comparable_sales failed: {e}")
        return []


async def fetch_price_history_serp(brand: str, model: str, color: str, leather: str, size: str) -> list:
    months = get_last_12_months()

    async def fetch_month(m):
        query = f"{brand} {model} {size} {leather} {color} resale price"
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                res = await client.post(
                    "https://google.serper.dev/search",
                    headers=SERPER_HEADERS,
                    json={
                        "q": query,
                        "tbs": f"cdr:1,cd_min:{m['min']},cd_max:{m['max']}"
                    }
                )
                res.raise_for_status()
                data = res.json()

            prices = []
            for result in data.get("organic", [])[:8]:
                snippet = result.get("snippet", "")
                title = result.get("title", "")
                text = f"{title} {snippet}"
                matches = re.findall(r'([\$£€])\s*([\d,]+\.?\d*)', text)
                for symbol, amount in matches:
                    price = extract_price(amount)
                    if price and price > 1000:
                        price = to_eur(price, symbol)
                        prices.append(price)
                        break

            if prices:
                avg = sum(prices) / len(prices)
                return {
                    "period": m["period"],
                    "avg_price": round(avg, 2),
                    "sample_count": len(prices),
                    "source": "serper"
                }
            return None
        except:
            return None

    results = []
    sem = asyncio.Semaphore(3)  # max 3 concurrent

    async def fetch_with_limit(m):
        async with sem:
            result = await fetch_month(m)
            await asyncio.sleep(0.3)
            return result

    results = await asyncio.gather(*[fetch_with_limit(m) for m in months])
    return [r for r in results if r]
