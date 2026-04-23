# import re
# import httpx
# from app.config import SERPER_API_KEY
# from datetime import datetime
# from dateutil.relativedelta import relativedelta


# def get_last_12_months() -> list:
#     months = []
#     today = datetime.today()

#     for i in range(11, -1, -1):
#         d = today - relativedelta(months=i)
#         first = d.replace(day=1)
#         last = (first + relativedelta(months=1)) - relativedelta(days=1)

#         months.append({
#             "period": d.strftime("%b %Y"),
#             "min": f"{first.month}/{first.day}/{first.year}",
#             "max": f"{last.month}/{last.day}/{last.year}"
#         })

#     return months


# def extract_price(price_str: str):
#     if not price_str:
#         return None
#     try:
#         match = re.search(r'[\d,]+\.?\d*', price_str.replace(",", ""))
#         if match:
#             return float(match.group())
#     except:
#         return None


# async def fetch_ebay_prices(query: str) -> list:
#     async with httpx.AsyncClient(timeout=20) as client:
#         res = await client.get(
#             "https://serpapi.com/search.json",
#             params={
#                 "engine": "google_shopping",
#                 "q": query + " ebay",
#                 "api_key": SERP_API_KEY
#             }
#         )
#         res.raise_for_status()
#         data = res.json()

#     results = []
#     for item in data.get("shopping_results", []):
#         price = extract_price(item.get("price"))
#         if price and price > 1000:
#             results.append({
#                 "price": price,
#                 "title": item.get("title", "")[:60],
#                 "source": "eBay"
#             })
#     return results


# async def fetch_google_shopping_prices(query: str) -> list:
#     async with httpx.AsyncClient(timeout=20) as client:
#         res = await client.get(
#             "https://serpapi.com/search.json",
#             params={
#                 "engine": "google_shopping",
#                 "q": query,
#                 "api_key": SERP_API_KEY
#             }
#         )
#         res.raise_for_status()
#         data = res.json()

#     prices = []
#     for item in data.get("shopping_results", []):
#         price = extract_price(item.get("price"))
#         if price:
#             prices.append(price)
#     return prices


# async def fetch_ebay_sold_prices(query: str) -> list:
#     async with httpx.AsyncClient(timeout=20) as client:
#         res = await client.get(
#             "https://serpapi.com/search.json",
#             params={
#                 "engine": "ebay",
#                 "q": query,
#                 "LH_Sold": "1",
#                 "LH_Complete": "1",
#                 "api_key": SERP_API_KEY
#             }
#         )
#         res.raise_for_status()
#         data = res.json()

#     prices = []
#     for item in data.get("organic_results", []):
#         price = extract_price(item.get("price", {}).get("raw"))
#         if price:
#             prices.append(price)
#     return prices


# async def fetch_google_search_prices(query: str) -> list:
#     """Scrapes Vestiaire, Fashionphile, TheRealReal via Google search"""
#     search_query = f'{query} site:vestiaire.com OR site:fashionphile.com OR site:therealreal.com OR site:rebag.com OR site:tradesy.com OR site:loveluxury.co.uk OR site:globalboutique.com OR site:sothebys.com'
#     async with httpx.AsyncClient(timeout=20) as client:
#         res = await client.get(
#             "https://serpapi.com/search.json",
#             params={
#                 "engine": "google",
#                 "q": search_query,
#                 "api_key": SERP_API_KEY
#             }
#         )
#         res.raise_for_status()
#         data = res.json()

#     prices = []
#     for result in data.get("organic_results", []):
#         # try to extract price from snippet
#         snippet = result.get("snippet", "")
#         matches = re.findall(r'\$[\d,]+\.?\d*', snippet)
#         for m in matches:
#             price = extract_price(m)
#             if price and price > 100:  # filter out noise
#                 prices.append(price)
#     return prices


# async def fetch_prices_serpapi(query: str) -> list:
#     all_prices = []
#     for fn in [fetch_google_shopping_prices, fetch_ebay_sold_prices, fetch_google_search_prices]:
#         try:
#             prices = await fn(query)
#             all_prices.extend(prices)
#         except:
#             continue
#     return all_prices


# async def fetch_bag_image(query: str) -> str:
#     try:
#         async with httpx.AsyncClient(timeout=20) as client:
#             res = await client.post(
#                 "https://google.serper.dev/images",
#                 headers={"X-API-KEY": SERPER_API_KEY},
#                 json={"q": query}
#             )
#             res.raise_for_status()
#             data = res.json()

#         results = data.get("images", [])
#         print(f"Image search for '{query}': {len(results)} results")
#         if results:
#             url = results[0].get("imageUrl", "")
#             print(f"Image URL: {url}")
#             return url
#         return ""
#     except Exception as e:
#         print(f"fetch_bag_image failed: {e}")
#         return ""


# async def fetch_comparable_sales(brand: str, model: str, color: str, leather: str, size: str) -> list:
#     # very specific query — all details included
#     query = f'"{brand} {model}" "{color}" "{leather}" sold price 2025 2026'

#     async with httpx.AsyncClient(timeout=20) as client:
#         res = await client.get(
#             "https://serpapi.com/search.json",
#             params={
#                 "engine": "google",
#                 "q": query,
#                 "api_key": SERP_API_KEY
#             }
#         )
#         res.raise_for_status()
#         data = res.json()

#     sales = []
#     for result in data.get("organic_results", [])[:10]:
#         snippet = result.get("snippet", "").lower()
#         title = result.get("title", "").lower()
#         source = result.get("source", "")

#         # ← filter: skip if color or leather not mentioned
#         if color.lower() not in snippet and color.lower() not in title:
#             continue
#         if leather.lower() not in snippet and leather.lower() not in title:
#             continue

#         matches = re.findall(r'[\$£€][\d,]+', snippet)
#         for m in matches:
#             price = extract_price(m)
#             if price and price > 500:
#                 sales.append({
#                     "description": result.get("title", "")[:60],
#                     "price": price,
#                     "source": source or "Google"
#                 })
#                 break

#     return sales[:5]


# async def fetch_price_history_serp(brand: str, model: str, color: str, leather: str, size: str) -> list:
#     import asyncio
#     months = get_last_12_months()

#     async def fetch_month(m):
#         query = f"{brand} {model} {size} {leather} {color} resale price"
#         try:
#             async with httpx.AsyncClient(timeout=20) as client:
#                 res = await client.get(
#                     "https://serpapi.com/search.json",
#                     params={
#                         "engine": "google",
#                         "q": query,
#                         "tbs": f"cdr:1,cd_min:{m['min']},cd_max:{m['max']}",
#                         "api_key": SERP_API_KEY
#                     }
#                 )
#                 res.raise_for_status()
#                 data = res.json()

#             prices = []
#             for result in data.get("organic_results", [])[:8]:
#                 snippet = result.get("snippet", "")
#                 matches = re.findall(r'[\$£€][\d,]+', snippet)
#                 for match in matches:
#                     price = extract_price(match)
#                     if price and price > 1000:
#                         prices.append(price)

#             if prices:
#                 avg = sum(prices) / len(prices)
#                 return {
#                     "period": m["period"],
#                     "avg_price": round(avg, 2),
#                     "sample_count": len(prices),
#                     "source": "serp"
#                 }
#             return None
#         except:
#             return None

#     results = []
#     for m in months:
#         result = await fetch_month(m)
#         if result:
#             results.append(result)
#         await asyncio.sleep(0.5)
#     return results

#     # results = await asyncio.gather(*[fetch_month(m) for m in months])
#     # return [r for r in results if r is not None]


import re
import httpx
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


async def fetch_google_shopping_prices(query: str) -> list:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://google.serper.dev/shopping",
                headers=SERPER_HEADERS,
                json={"q": query}
            )
            res.raise_for_status()
            data = res.json()

        prices = []
        for item in data.get("shopping", []):
            price = extract_price(item.get("price"))
            if price:
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
                json={"q": query + " ebay"}
            )
            res.raise_for_status()
            data = res.json()

        results = []
        for item in data.get("shopping", []):
            price = extract_price(item.get("price"))
            if price and price > 1000:
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
                json={"q": query + " ebay sold completed listings"}
            )
            res.raise_for_status()
            data = res.json()

        prices = []
        for result in data.get("organic", []):
            snippet = result.get("snippet", "")
            matches = re.findall(r'[\$£€][\d,]+\.?\d*', snippet)
            for m in matches:
                price = extract_price(m)
                if price and price > 500:
                    prices.append(price)
        return prices
    except Exception as e:
        print(f"fetch_ebay_sold_prices failed: {e}")
        return []


async def fetch_google_search_prices(query: str) -> list:
    try:
        search_query = f'{query} site:vestiaire.com OR site:fashionphile.com OR site:therealreal.com OR site:rebag.com OR site:loveluxury.co.uk OR site:bagista.co.uk OR site:portero.com OR site:janefinds.com OR site:privesale.com OR site:collectorsquare.com OR site:labellov.com OR site:judithsgems.com OR site:heritage auctions OR site:christies.com OR site:sothebys.com'
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://google.serper.dev/search",
                headers=SERPER_HEADERS,
                json={"q": search_query}
            )
            res.raise_for_status()
            data = res.json()

        prices = []
        for result in data.get("organic", []):
            snippet = result.get("snippet", "")
            matches = re.findall(r'[\$£€][\d,]+\.?\d*', snippet)
            for m in matches:
                price = extract_price(m)
                if price and price > 100:
                    prices.append(price)
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
        # print(f"Image search for '{query}': {len(results)} results")
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
        # print(f"fetch_bag_image failed: {e}")
        return ""


async def fetch_comparable_sales(brand: str, model: str, color: str, leather: str, size: str) -> list:
    try:
        query = f'{brand} {model} {color} {leather} sold price 2025 2026'
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://google.serper.dev/search",
                headers=SERPER_HEADERS,
                json={"q": query}
            )
            res.raise_for_status()
            data = res.json()

        sales = []
        for result in data.get("organic", [])[:10]:
            snippet = result.get("snippet", "").lower()
            title = result.get("title", "").lower()
            source = result.get("source", "")

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
    except Exception as e:
        print(f"fetch_comparable_sales failed: {e}")
        return []


async def fetch_price_history_serp(brand: str, model: str, color: str, leather: str, size: str) -> list:
    import asyncio
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
                    "source": "serper"
                }
            return None
        except:
            return None

    results = []
    for m in months:
        result = await fetch_month(m)
        if result:
            results.append(result)
        await asyncio.sleep(0.3)
    return results
