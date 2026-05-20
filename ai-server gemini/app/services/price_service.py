import json
import asyncio
import httpx
from app.config import OPENAI_API_KEY
import os
from app.services.serp_service import fetch_comparable_sales, fetch_prices_serpapi, fetch_ebay_prices

# Assume KNOWLEDGE_BASE is imported or read from knowledge.txt
# with open("knowledge.txt", "r") as f: KNOWLEDGE_BASE = f.read()

BASE_DIR = os.path.dirname(__file__)
KNOWLEDGE_PATH = os.path.join(BASE_DIR, "knowledge.txt")

# Load the file
if os.path.exists(KNOWLEDGE_PATH):
    with open(KNOWLEDGE_PATH, "r", encoding="utf-8") as f:
        KNOWLEDGE_BASE = f.read()
else:
    # Fallback or error if file is missing
    KNOWLEDGE_BASE = "Knowledge base file not found."


CONDITION_MULTIPLIER = {
    "New": 1.15,
    "Excellent": 1.00,
    "Very Good": 0.88,
    "Good": 0.75,
    "Fair": 0.60,
    "Poor": 0.45
}


def calculate_weighted_average(raw_prices, ebay_sold, ebay_listed):
    """Calculates a weighted mean across sources correctly."""
    def mean(data): return sum(data) / len(data) if data else 0

    avg_raw = mean(raw_prices)
    avg_sold = mean(ebay_sold)
    avg_listed = mean(ebay_listed)

    # Weighting: Sold data is king (60%), Listed is secondary (20%), Web prices (20%)
    weights = {"sold": 0.6, "listed": 0.2, "web": 0.2}

    # If a source is missing, re-distribute weights or handle gracefully
    total_weight = 0
    final_avg = 0

    if avg_sold:
        final_avg += avg_sold * weights["sold"]
        total_weight += weights["sold"]
    if avg_listed:
        final_avg += avg_listed * weights["listed"]
        total_weight += weights["listed"]
    if avg_raw:
        final_avg += avg_raw * weights["web"]
        total_weight += weights["web"]

    return final_avg / total_weight if total_weight > 0 else 0


async def fetch_price_gemini(brand, model_name, color, condition, leather, hardware, size, special_variant, stamp_year):
    prompt = f"""
    Using your luxury market expertise and the provided REFERENCE KNOWLEDGE:
    Brand: {brand} | Model: {model_name} | Color: {color} | Leather: {leather} 
    Hardware: {hardware} | Size: {size} | Condition: {condition} | Year: {stamp_year}

    REFERENCE KNOWLEDGE:
    {KNOWLEDGE_BASE}

    Return ONLY JSON. Ensure the 'current_value' reflects the rarity of colors like '{color}'.
    """

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}",
                     "Content-Type": "application/json"},
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
        return json.loads(data["choices"][0]["message"]["content"])


async def fetch_fresh_price(brand, model, color, condition, leather="", hardware="", size="",
                            special_variant="Standard", stamp_year="", is_bicolor=False,
                            is_hss=False):

    query = f"{brand} {model} {size} {leather} {color} bag price"

    # 1. FETCH DATA
    raw_prices = await fetch_prices_serpapi(query)
    real_sales = await fetch_comparable_sales(brand, model, color, leather, size)
    ebay_results = await fetch_ebay_prices(query)

    # Since fetch_ebay_prices doesn't distinguish sold/listed, treat all as listed:
    ebay_listed = [r["price"] for r in ebay_results if "price" in r]
    ebay_sold = []  # or use fetch_ebay_sold_prices separately

    # 2. CORRECT WEIGHTED MATH
    base_price = calculate_weighted_average(raw_prices, ebay_sold, ebay_listed)

    # 3. APPLY MULTIPLIERS (Logic refined by Brand)
    condition_factor = CONDITION_MULTIPLIER.get(condition, 1.0)
    special_multiplier = 1.0

    if is_hss and brand == "Hermes":
        special_multiplier *= 1.8  # HSS Premium
    elif is_bicolor:
        special_multiplier *= 1.15  # Standard Bicolor Premium

    # 4. FALLBACK
    if base_price == 0 or (len(raw_prices) + len(ebay_sold)) < 2:
        return await fetch_price_gemini(brand, model, color, condition, leather, hardware, size, special_variant, stamp_year)

    final_calculated_price = base_price * condition_factor * special_multiplier

    # 5. GEMINI REFINEMENT (The "Expert Review")
    metadata = {
        "calculated_price": final_calculated_price,
        "brand": brand,
        "color": color,
        "leather": leather,
        "condition": condition,
        "ebay_count": len(ebay_sold),
        "knowledge_context": "Check color rarity for " + color
    }

    expert_prompt = f"""
    Review this price: {final_calculated_price} EUR.
    Based on KNOWLEDGE_BASE, is '{color}' a high-premium color (like Rouge Cabernet or Rose Sakura)? 
    Adjust the final_value if the base market data doesn't account for color rarity.
    
    DATA: {json.dumps(metadata)}
    KNOWLEDGE: {KNOWLEDGE_BASE}
    
    Return JSON with fields: current_value, reasoning, trend.
    """

    async with httpx.AsyncClient(timeout=30) as http_client:
        res = await http_client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}",
                     "Content-Type": "application/json"},
            json={
                "model": "gpt-4o",
                "max_tokens": 500,
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
                "messages": [{"role": "user", "content": expert_prompt}]
            }
        )
        res.raise_for_status()
        data = res.json()
        result = json.loads(data["choices"][0]["message"]["content"])
    return result
