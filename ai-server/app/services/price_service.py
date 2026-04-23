import httpx
import json
import re
import asyncio
from app.config import OPENAI_API_KEY
from app.services.serp_service import fetch_prices_serpapi, fetch_comparable_sales, fetch_ebay_prices, fetch_price_history_serp


async def fetch_price_gpt(brand: str, model: str, color: str, condition: str,
                          leather: str = "", hardware: str = "",
                          size: str = "", special_variant: str = "Standard",
                          stamp_year: str = "") -> dict:
    """
    Primary: GPT-4o market price lookup
    """
    prompt = f"""You are a luxury bag market expert. Find the closest current market price for this exact bag.

Brand: {brand}
Model: {model}
Color: {color}
Leather: {leather}
Hardware: {hardware}
Size: {size}
Condition: {condition}
Special Variant: {special_variant}
Production Year: {stamp_year}

PRICING PRIORITY (check in this order):
1. Recent resale sold prices (Vestiaire, The RealReal, Fashionphile, eBay sold)
2. Current resale asking prices (same platforms)
3. Current retail price (brand boutique or authorized retailer)
4. Estimated value based on comparable models

Use whichever source gives the MOST ACCURATE price for this specific bag.
If resale is higher than retail (common for Hermès), use resale.
If bag is brand new condition and retail is available, include both.


Return ONLY JSON:
{{
  "current_value": number,
  "currency": "EUR",
  "trend": "up|down|stable",
  "change_percentage": number,
  "price_range": {{
    "min": number,
    "max": number
  }},
  "retail_price": number or null,
  "resale_premium": "X% above retail" or null,
  "source": "eBay sold + Vestiaire + Google Shopping",
  "reasoning": "2-3 sentence explanation including condition impact",
  "condition_impact": "Excellent condition adds ~15% to base value" ,
  "comparable_sales": [
    {{"description": "specific sale description with date",
        "price": number, "source": "platform name"}},
    {{"description": "specific sale description with date",
        "price": number, "source": "platform name"}},
    {{"description": "specific sale description with date",
        "price": number, "source": "platform name"}}
  ]
}}

FIELD RULES:
- price_type: "resale_sold" | "resale_asking" | "retail" | "estimated"
- current_value: the single most accurate price you can give
- retail_price: current boutique price if known, otherwise null
- resale_premium_percentage: how much above retail, null if below retail
- trend: "up" | "down" | "stable"
- change_percentage: vs 12 months ago
- source: where the price data comes from
- sample_count: how many comparable sales used
- Return all prices in EUR. Convert from USD using current exchange rates.
- Only use comparable sales that are realistic resale prices, ignore fake bag resale prices

CONDITION ADJUSTMENTS:
Pristine +15% | Excellent base | Very Good -12% | Good -25% | Fair -40% | Poor -55%

SPECIAL VARIANT PREMIUMS:
HSS / Special Order +30-200% | Crocodile +300-1000% | Ostrich +100-300%
Bicolor / Verso +20-50% | Limited Edition +50-500%

Return ONLY the JSON object."""

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-4o",
                "max_tokens": 800,
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
                "messages": [{"role": "user", "content": prompt}]
            }
        )
        res.raise_for_status()
        data = res.json()
        text = data["choices"][0]["message"]["content"].strip()
        try:
            parsed = json.loads(text)
        except:
            return {"current_value": 0, "currency": "EUR", "trend": "stable",
                    "change_percentage": 0, "price_range": {"min": 0, "max": 0},
                    "source": "error", "sample_count": 0}

        # normalize to your existing structure
        return {
            "current_value": parsed.get("current_value", 0.0),
            "currency": parsed.get("currency", "EUR"),
            "trend": parsed.get("trend", "stable"),
            "change_percentage": parsed.get("change_percentage", 0.0),
            "price_range": parsed.get("price_range", {"min": 0.0, "max": 0.0}),
            "retail_price": parsed.get("retail_price"),
            "resale_premium": f"{parsed.get('resale_premium_percentage')}% above retail" if parsed.get("resale_premium_percentage") else parsed.get("resale_premium"),
            "source": parsed.get("source", "estimated"),
            "sample_count": parsed.get("sample_count", 0),
            "reasoning": parsed.get("reasoning"),
            "condition_impact": parsed.get("condition_impact", f"{condition} condition applied to pricing"),
            "comparable_sales": parsed.get("comparable_sales", [])
        }


def clean_prices(prices: list) -> list:
    if not prices:
        return []

    prices = sorted(prices)
    q1 = prices[len(prices)//4]
    q3 = prices[(len(prices)*3)//4]
    iqr = q3 - q1

    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr

    return [p for p in prices if lower <= p <= upper]


async def analyze_prices_with_gpt(prices: list, metadata: dict) -> dict:
    prompt = f"""
You are a luxury bag pricing expert.

REAL market prices collected: {prices}

Bag details:
- Brand: {metadata.get('brand')}
- Model: {metadata.get('model')}
- Color: {metadata.get('color')}
- Leather: {metadata.get('leather')}
- Size: {metadata.get('size')}
- Condition: {metadata.get('condition')}
- Currency: {metadata.get('currency', 'EUR')}

Real comparable sales from eBay (use these, do not invent): {metadata.get('real_comparable_sales')}
eBay listings for comparison: {metadata.get('ebay_listings')}

IMPORTANT PRICING RULES:
- Condition is: {metadata.get('condition')} — apply this EXACTLY:
  Pristine/Box Fresh +15% | Excellent = base | Very Good -12% | Good -25% | Fair -40% | Poor -55%
- condition_impact field MUST say "{metadata.get('condition')} condition" not "Excellent condition"
- For Hermès bags always fill retail_price (Birkin 30 ≈ €13,900, Mini Kelly 20 ≈ €8,000, Kelly 25 ≈ €9,600)
- resale_premium = calculate from retail_price if known
- Ignore any prices below €5,000 — likely fake or unrelated items
- Return all prices in {metadata.get('currency', 'EUR')}

Return ONLY JSON:
{{
  "current_value": number,
  "currency": "{metadata.get('currency', 'EUR')}",
  "trend": "up|down|stable",
  "change_percentage": number,
  "price_range": {{
    "min": number,
    "max": number
  }},
  "retail_price": number or null,
  "resale_premium": "X% above retail" or null,
  "source": "eBay sold + Vestiaire + Google Shopping",
  "reasoning": "2-3 sentence explanation including condition impact",
  "condition_impact": "Excellent condition adds ~15% to base value",
  "comparable_sales": [
    {{"description": "specific sale with date", "price": number, "source": "platform"}},
    {{"description": "specific sale with date", "price": number, "source": "platform"}},
    {{"description": "specific sale with date", "price": number, "source": "platform"}}
  ]
}}
"""

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-4o",
                "temperature": 0.2,
                "max_tokens": 1000,
                "response_format": {"type": "json_object"},
                "messages": [{"role": "user", "content": prompt}]
            }
        )

    res.raise_for_status()
    data = res.json()
    return json.loads(data["choices"][0]["message"]["content"])


async def fetch_fresh_price(
    brand, model, color, condition,
    leather="", hardware="", size="",
    special_variant="Standard", stamp_year="",
    is_bicolor=False, is_hss=False,        # ← add these
    secondary_color=""                      # ← add this
) -> dict:

    query = f"{brand} {model} {size} {leather} {color} bag price"

    # 1. Get real prices
    raw_prices, real_sales, ebay_results = await asyncio.gather(
        fetch_prices_serpapi(query),
        fetch_comparable_sales(brand, model, color, leather, size),
        fetch_ebay_prices(f"{brand} {model} {size} {leather} {color}")
    )

    # extract just prices from ebay for analysis
    ebay_prices = [r["price"] for r in ebay_results]

    # combine all prices for analysis
    all_prices = raw_prices + ebay_prices

    # 2. Fallback to GPT if no data
    if not all_prices:
        return await fetch_price_gpt(
            brand, model, color, condition,
            leather, hardware, size, special_variant, stamp_year
        )

    # 3. Clean data
    cleaned = clean_prices(all_prices)

    if len(cleaned) < 3:
        cleaned = all_prices

    # 4. Metadata
    metadata = {
        "brand": brand,
        "model": model,
        "color": color,
        "condition": condition,
        "leather": leather,
        "size": size,
        "ebay_listings": ebay_results,
        "real_comparable_sales": real_sales,
        "currency": "EUR"
    }

    # 5. GPT analysis
    result = await analyze_prices_with_gpt(cleaned, metadata)

    # 6. Final output
    return {
        "current_value": result.get("current_value", 0.0),
        "currency": result.get("currency", "EUR"),
        "trend": result.get("trend", "stable"),
        "change_percentage": result.get("change_percentage", 0.0),
        "price_range": result.get("price_range", {"min": 0.0, "max": 0.0}),
        "retail_price": result.get("retail_price"),
        "resale_premium": result.get("resale_premium"),
        "source": result.get("source", "hybrid"),
        "sample_count": len(cleaned),
        "reasoning": result.get("reasoning"),
        "condition_impact": result.get("condition_impact"),
        "comparable_sales": result.get("comparable_sales", [])
    }


async def fetch_price_history(
    brand: str,
    model: str,
    color: str,
    leather: str = "",
    size: str = "",
    condition: str = "",
    current_price: float = 0.0
) -> dict:
    from app.services.serp_service import get_last_12_months
    months = get_last_12_months()
    history_entries = "\n".join([
        f'    {{"period": "{m["period"]}", "avg_price": number, "source": "estimated"}},'
        for m in months
    ])

    prompt = f"""You are a luxury bag market expert with deep knowledge of resale price trends.
Provide realistic monthly average resale prices in EUR for this exact bag over the last 12 months.

IMPORTANT: The current market price (latest month) is approximately €{current_price} for this bag in {condition} condition.
Work backwards from this using Hermès market trends (prices rose ~35% in 2025 vs 2024, 6-10% annually):
- Hermès annual price increases (6-10% per year)
- Seasonal patterns (higher in Dec/Jan, slightly lower in summer)
- Recent market trends (Birkin prices rose ~35% in 2025 vs 2024)

Brand: {brand}
Model: {model}
Color: {color}
Leather: {leather}
Size: {size}
Condition: {condition}

Return ONLY JSON:
{{
  "history": [
{history_entries}
  ],
  "note": "Historical estimates based on market knowledge"
}}"""

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-4o",
                "max_tokens": 1000,
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
                "messages": [{"role": "user", "content": prompt}]
            }
        )
    res.raise_for_status()
    parsed = json.loads(res.json()["choices"][0]["message"]["content"])
    return {
        "history": parsed.get("history", []),
        "source": "gpt_estimated",
        "note": "Estimated from GPT market knowledge — not real-time data"
    }
