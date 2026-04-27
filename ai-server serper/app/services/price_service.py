import json
import httpx
from app.config import OPENAI_API_KEY
from app.services.serp_service import fetch_all_market_prices
from datetime import datetime

# ─────────────────────────────────────────
# CONDITION MULTIPLIERS
# ─────────────────────────────────────────

CONDITION_MULTIPLIER = {
    "New":       1.15,
    "Excellent": 1.00,
    "Very Good": 0.88,
    "Good":      0.75,
    "Fair":      0.60,
    "Poor":      0.45,
}

SPECIAL_MULTIPLIER = {
    "HSS":      1.80,   # Hermes Special Order
    "Bicolor":  1.15,
    "Standard": 1.00,
}

today = datetime.today().strftime("%B %Y")  # e.g. "April 2026"

# ─────────────────────────────────────────
# GPT HELPER
# ─────────────────────────────────────────


async def call_gpt(prompt: str, max_tokens: int = 800) -> dict:
    """Single reusable GPT-4o call. Always returns JSON."""
    async with httpx.AsyncClient(timeout=40) as client:
        res = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-4o",
                "max_tokens": max_tokens,
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
                "messages": [{"role": "user", "content": prompt}]
            }
        )
        res.raise_for_status()
        data = res.json()
        return json.loads(data["choices"][0]["message"]["content"])


# ─────────────────────────────────────────
# CURRENT PRICE
# ─────────────────────────────────────────

async def get_current_price(
    brand: str,
    model: str,
    color: str,
    leather: str,
    hardware: str,
    size: str,
    condition: str,
    special_variant: str = "Standard",
) -> dict:
    """
    Step 1: Fetch real market data from all sources.
    Step 2: Apply condition + special variant multipliers.
    Step 3: GPT refines ONLY if real data is thin (< 4 points).
    Returns: current_price (EUR), confidence, sources_used, reasoning.
    """

    # ── Step 1: Real market data ──────────────────────────
    market = await fetch_all_market_prices(brand, model, size, leather, color)

    base_price = market["weighted_price"]
    data_points = market["data_points"]
    needs_gpt = market["needs_gpt_fallback"]

    sources_used = []
    if market["retail_prices"]:
        sources_used.append("Google Shopping (retail)")
    if market["reseller_prices"]:
        sources_used.append("Vestiaire/1stDibs/RealReal")
    if market["ebay_prices"]:
        sources_used.append("eBay")

    # ── Step 2: Apply multipliers ─────────────────────────
    condition_factor = CONDITION_MULTIPLIER.get(condition, 1.0)
    special_factor = SPECIAL_MULTIPLIER.get(special_variant, 1.0)

    # Only apply special multiplier for Hermes HSS
    if special_variant == "HSS" and brand.lower() not in ["hermès", "hermes"]:
        special_factor = 1.0

    adjusted_price = round(base_price * condition_factor * special_factor, 2)

    # ── Step 3: GPT fallback / refinement ────────────────
    if needs_gpt or adjusted_price == 0:
        prompt = f"""
You are a luxury handbag pricing expert. Estimate the current resale market price in EUR for:

Brand: {brand}
Model: {model}
Color: {color}
Leather: {leather}
Hardware: {hardware}
Size: {size}
Condition: {condition}
Special Variant: {special_variant}

{"The following real market prices were found but are limited: " + str(market) if base_price > 0 else "No real market data was found."}

Return ONLY a JSON object with these fields:
- current_price: number (EUR)
- confidence: "low" | "medium" | "high"  
- reasoning: string (1-2 sentences explaining the price)
- color_premium: boolean (is this color considered rare/premium?)
        """
        result = await call_gpt(prompt)
        result["sources_used"] = sources_used or ["GPT-4o estimate"]
        result["data_points"] = data_points
        return result

    # ── Real data was sufficient — return directly ────────
    return {
        "current_price": adjusted_price,
        "confidence": "high" if data_points >= 6 else "medium",
        "sources_used": sources_used,
        "data_points": data_points,
        "reasoning": f"Based on {data_points} real market listings. Condition ({condition}) and variant ({special_variant}) multipliers applied.",
        "color_premium": False  # GPT not called, so we don't know
    }


# ─────────────────────────────────────────
# PRICE HISTORY (last 10 months)
# ─────────────────────────────────────────

async def get_price_history(
    brand: str,
    model: str,
    color: str,
    leather: str,
    size: str,
    current_price: float,
) -> list[dict]:
    """
    Today is {today}. Generate a realistic monthly price history for the LAST 12 MONTHS (not including current month).
    The history MUST start from June 2025 and end at April 2026. Do not use any other date range.
    The prices should reflect real luxury market behavior:
    - Gradual appreciation or depreciation trends (not random jumps)
    - Seasonal effects if applicable (e.g. slower summer, stronger Q4)
    - Color/leather rarity premium if this is a sought-after combination
    - Month-to-month changes should be realistic: typically 1-4% max between adjacent months
    """

    prompt = f"""

    You are a luxury resale market analyst specializing in {brand} handbags.

    Today is {today}. Given that this bag is currently worth approximately {current_price} EUR:

    Brand: {brand}
    Model: {model}
    Color: {color}
    Leather: {leather}
    Size: {size}
    Current Price (today): {current_price} EUR

    Generate a realistic monthly price history for the LAST 12 MONTHS (not including current month).
    The history MUST start from April 2025 and end at March 2026. Do not use any other date range.
    The prices should reflect real luxury market behavior:
    - Gradual appreciation or depreciation trends (not random jumps)
    - Seasonal effects if applicable (e.g. slower summer, stronger Q4)
    - Color/leather rarity premium if this is a sought-after combination
    - Month-to-month changes should be realistic: typically 1-4% max between adjacent months

    Return ONLY a JSON object with:
    - history: array of exactly 12 objects in chronological order, each with:
        - month: string formatted as "Mon YYYY" e.g. "Apr 2025", "May 2025" ... "Mar 2026"
        - price: number in EUR (integer, no decimals)
    - trend: "appreciating" | "depreciating" | "stable"
    - trend_note: string (1 sentence about the overall trend)   

    """

    result = await call_gpt(prompt, max_tokens=1000)
    return result


# ─────────────────────────────────────────
# MAIN ENTRY — full valuation
# ─────────────────────────────────────────

async def get_full_valuation(
    brand: str,
    model: str,
    color: str,
    leather: str,
    hardware: str,
    size: str,
    condition: str,
    special_variant: str = "Standard",
) -> dict:
    """
    Full valuation: current price + 10-month history.
    This is the main function to call from your API endpoint.

    Returns:
    {
        "current_price": 9400,
        "confidence": "high",
        "sources_used": [...],
        "data_points": 7,
        "reasoning": "...",
        "color_premium": true,
        "history": [
            {"month": "Jun 2024", "price": 8600},
            ...
        ],
        "trend": "appreciating",
        "trend_note": "..."
    }
    """

    # Step 1: Get current price
    current_result = await get_current_price(
        brand=brand,
        model=model,
        color=color,
        leather=leather,
        hardware=hardware,
        size=size,
        condition=condition,
        special_variant=special_variant,
    )

    current_price = current_result.get("current_price", 0)

    # Step 2: Get 10-month history anchored to current price
    history_result = await get_price_history(
        brand=brand,
        model=model,
        color=color,
        leather=leather,
        size=size,
        current_price=current_price,
    )

    # Step 3: Merge and return
    return {
        **current_result,
        "history":    history_result.get("history", []),
        "trend":      history_result.get("trend", "stable"),
        "trend_note": history_result.get("trend_note", ""),
    }
