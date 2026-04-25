import json
import asyncio
import google.generativeai as genai

from app.services.serp_service import (
    fetch_prices_serpapi,
    fetch_comparable_sales,
    fetch_ebay_prices
)

# =========================
# GEMINI CONFIG
# =========================
genai.configure(api_key="GEMINI_API_KEY")
model = genai.GenerativeModel("gemini-1.5-pro")


# =========================
# CONDITION MULTIPLIER
# =========================
CONDITION_MULTIPLIER = {
    "New": 1.15,
    "Excellent": 1.00,
    "Very Good": 0.88,
    "Good": 0.75,
    "Fair": 0.60,
    "Poor": 0.45
}


# =========================
# GPT (GEMINI) PRICE FALLBACK
# =========================
async def fetch_price_gemini(
    brand: str,
    model_name: str,
    color: str,
    condition: str,
    leather: str = "",
    hardware: str = "",
    size: str = "",
    special_variant: str = "Standard",
    stamp_year: str = ""
) -> dict:

    prompt = f"""
You are a luxury bag market pricing expert.

Use ONLY provided information. Do NOT assume external sources.

Brand: {brand}
Model: {model_name}
Color: {color}
Leather: {leather}
Hardware: {hardware}
Size: {size}
Condition: {condition}
Variant: {special_variant}
Year: {stamp_year}

Return ONLY valid JSON:

{{
  "current_value": number,
  "currency": "EUR",
  "trend": "up|down|stable",
  "change_percentage": number,
  "price_range": {{"min": number, "max": number}},
  "retail_price": number or null,
  "resale_premium": "X% above retail" or null,
  "source": "estimated",
  "reasoning": "2-3 sentence explanation",
  "condition_impact": "{condition} condition applied",
  "comparable_sales": []
}}
"""

    def call_gemini():
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.2,
                "max_output_tokens": 1200
            }
        )
        return response.text

    text = await asyncio.to_thread(call_gemini)

    try:
        return json.loads(text)
    except:
        return {
            "current_value": 0,
            "currency": "EUR",
            "trend": "stable",
            "change_percentage": 0,
            "price_range": {"min": 0, "max": 0},
            "retail_price": None,
            "resale_premium": None,
            "source": "error",
            "reasoning": "Failed to parse Gemini output",
            "condition_impact": condition,
            "comparable_sales": []
        }


# =========================
# CLEAN PRICES
# =========================
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


# =========================
# MAIN PRICE ENGINE
# =========================
async def fetch_fresh_price(
    brand,
    model,
    color,
    condition,
    leather="",
    hardware="",
    size="",
    special_variant="Standard",
    stamp_year="",
    is_bicolor=False,
    is_hss=False,
    secondary_color=""
):

    query = f"{brand} {model} {size} {leather} {color} bag price"

    # =========================
    # 1. FETCH DATA SOURCES
    # =========================
    raw_prices, real_sales, ebay_results = await asyncio.gather(
        fetch_prices_serpapi(query),
        fetch_comparable_sales(brand, model, color, leather, size),
        fetch_ebay_prices(query)
    )

    ebay_sold = [r["price"] for r in ebay_results if r.get("type") == "sold"]
    ebay_listed = [r["price"]
                   for r in ebay_results if r.get("type") == "listed"]

    # weighted pricing
    weighted_prices = (
        [p * 0.3 for p in raw_prices] +
        [p * 0.7 for p in ebay_sold] +
        [p * 0.2 for p in ebay_listed]
    )

    all_prices = raw_prices + ebay_sold + ebay_listed

    # =========================
    # 2. CONDITION MULTIPLIER
    # =========================
    condition_factor = CONDITION_MULTIPLIER.get(condition, 1.0)

    # =========================
    # 3. SPECIAL VARIANT MULTIPLIER
    # =========================
    special_multiplier = 1.0

    if is_hss:
        special_multiplier *= 2.0

    if is_bicolor:
        special_multiplier *= 1.3

    # =========================
    # 4. FALLBACK IF NO DATA
    # =========================
    if len(all_prices) < 3:
        return await fetch_price_gemini(
            brand, model, color, condition,
            leather, hardware, size,
            special_variant, stamp_year
        )

    # =========================
    # 5. CLEAN PRICES
    # =========================
    cleaned = clean_prices(weighted_prices)

    if len(cleaned) < 3:
        cleaned = weighted_prices

    base_price = sum(cleaned) / len(cleaned)

    final_price = base_price * condition_factor * special_multiplier

    # =========================
    # 6. GEMINI REFINEMENT
    # =========================
    metadata = {
        "brand": brand,
        "model": model,
        "color": color,
        "condition": condition,
        "leather": leather,
        "size": size,
        "ebay_listings": ebay_results,
        "real_comparable_sales": real_sales,
        "currency": "EUR",
        "condition_factor": condition_factor,
        "special_multiplier": special_multiplier,
        "base_price": base_price,
        "final_price": final_price
    }

    def call_gemini():
        prompt = f"""
You are a luxury resale pricing expert.

Base price: {base_price}
Final adjusted price: {final_price}

Metadata:
{json.dumps(metadata, indent=2)}

Return ONLY JSON:
{{
  "current_value": number,
  "currency": "EUR",
  "trend": "up|down|stable",
  "change_percentage": number,
  "price_range": {{"min": number, "max": number}},
  "retail_price": null,
  "resale_premium": null,
  "source": "hybrid model",
  "reasoning": "2-3 sentence explanation",
  "condition_impact": "{condition} condition applied",
  "comparable_sales": []
}}
"""

        response = model.generate_content(prompt)
        return response.text

    result_text = await asyncio.to_thread(call_gemini)

    try:
        result = json.loads(result_text)
    except:
        result = {
            "current_value": final_price,
            "currency": "EUR",
            "trend": "stable",
            "change_percentage": 0,
            "price_range": {
                "min": final_price * 0.9,
                "max": final_price * 1.1
            },
            "source": "fallback",
            "reasoning": "Fallback due to parsing error",
            "condition_impact": condition,
            "comparable_sales": []
        }

    # =========================
    # 7. FINAL OUTPUT
    # =========================
    return {
        "current_value": result.get("current_value", final_price),
        "currency": "EUR",
        "trend": result.get("trend", "stable"),
        "change_percentage": result.get("change_percentage", 0.0),
        "price_range": result.get(
            "price_range",
            {"min": final_price * 0.9, "max": final_price * 1.1}
        ),
        "retail_price": result.get("retail_price"),
        "resale_premium": result.get("resale_premium"),
        "source": result.get("source", "hybrid"),
        "sample_count": len(cleaned),
        "reasoning": result.get("reasoning"),
        "condition_impact": result.get("condition_impact"),
        "comparable_sales": result.get("comparable_sales", [])
    }
