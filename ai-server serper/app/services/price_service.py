import json
import httpx
from app.config import OPENAI_API_KEY
from app.services.serp_service import fetch_all_market_prices
from datetime import datetime
from app.services.brand_config import is_investment_piece, is_depreciating


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


def get_special_factor(special_variant: str) -> float:
    """Smart lookup — works even with free text special_variant."""
    if not special_variant:
        return 1.0
    v = special_variant.lower()
    if "hss" in v:
        return 1.80
    if "bicolor" in v or "bi-color" in v or "two tone" in v:
        return 1.15
    if "cargo" in v:
        return 1.25
    return 1.00


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
    construction: str,
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
    market = await fetch_all_market_prices(brand, model, size, leather, color, condition, construction, special_variant)

    base_price = market["resale_price"] or 0
    data_points = market["data_points"]
    needs_gpt = market["needs_gpt_fallback"]

    sources_used = []
    if market["retail_sources"]:
        sources_used.append({
            "type": "Official Retail",
            "sites": list(set(s["source"] for s in market["retail_sources"]))
        })
    if market["reseller_sources"]:
        sources_used.append({
            "type": "Luxury Resellers",
            "sites": list(set(s["source"] for s in market["reseller_sources"]))
        })
    if market["ebay_sources"]:
        sources_used.append({
            "type": "eBay",
            "sites": list(set(s["source"] for s in market["ebay_sources"]))
        })

    # ── Step 2: Apply multipliers ─────────────────────────
    # ── Step 2: Smart multiplier logic ─────────────────────────
    is_investment = is_investment_piece(brand, model)
    is_depreciating_brand = is_depreciating(brand)

    condition_factor = CONDITION_MULTIPLIER.get(condition.capitalize(), 1.0)
    special_factor = get_special_factor(special_variant)

    # Only apply special multiplier for Hermes HSS
    if "hss" in special_variant.lower() and brand.lower() not in ["hermès", "hermes"]:
        special_factor = 1.0

    if is_investment:
        # Investment bags — trust resale price as-is
        # Only apply special variant multiplier (HSS, Bicolor)
        adjusted_price = round(base_price * special_factor, 2)
        pricing_note = "Investment piece — resale price reflects market premium over retail"

    elif is_depreciating_brand:
        # Depreciating brands — apply full condition multiplier
        adjusted_price = round(
            base_price * condition_factor * special_factor, 2)
        pricing_note = f"Condition ({condition}) and variant ({special_variant}) multipliers applied"

    else:
        # Unknown brand — apply mild condition adjustment only
        mild_factor = 1 + (condition_factor - 1) * 0.5  # half the multiplier
        adjusted_price = round(base_price * mild_factor * special_factor, 2)
        pricing_note = "Partial condition adjustment applied"

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
Construction: {construction}
Special Variant: {special_variant}

{"The following real market prices were found but are limited: " + str(market) if base_price > 0 else "No real market data was found."}

Return ONLY a JSON object with these fields:
    - current_value: number (EUR)
    - currency: "EUR"
    - confidence: "low" | "medium" | "high"
    - trend: "appreciating" | "depreciating" | "stable"
    - change_percentage: number (estimated % change over last 12 months)
    - price_range: object with min and max (EUR)
    - retail_price: number (EUR, new from boutique)
    - resale_premium: number (% premium over retail, can be negative)
    - color_premium: boolean
        """
        result = await call_gpt(prompt)
        result["sources_used"] = sources_used or ["GPT-4o estimate"]
        result["data_points"] = data_points
        return result

    # ── Real data was sufficient — return directly ────────
    return {
        "current_value": adjusted_price,
        "currency": "EUR",
        "confidence": "high" if data_points >= 6 else "medium",
        "change_percentage": 0.0,
        "price_range": {"min": round(adjusted_price * 0.9, 2), "max": round(adjusted_price * 1.1, 2)},
        "retail_price": market["retail_price"],
        "resale_premium": None,
        "sources_used": sources_used,
        "data_points": data_points,
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
        - period: string formatted as "Mon YYYY" e.g. "Apr 2025", "May 2025" ... "Mar 2026"
        - avg_price: number in EUR (integer, no decimals)
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
    construction: str,
    special_variant: str = "Standard",
    purchase_price: float = None,   # ← add this
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
        "color_premium": true,
        "history": [
            {"month": "Jun 2024", "price": 8600},
            ...
        ],
        "trend": "appreciating"
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
        construction=construction,
        special_variant=special_variant,
    )

    current_price = current_result.get("current_value", 0)

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
# Step 3: Calculate change percentage
    current_price = current_result.get("current_value", 0)
    history = history_result.get("history", [])

    if purchase_price and purchase_price > 0:
        # Compare with actual purchase price
        change_percentage = round(
            ((current_price - purchase_price) / purchase_price) * 100, 2)
        change_basis = "purchase_price"
    elif history:
        # Compare with average of historical prices
        avg_historical = sum(h["avg_price"] for h in history) / len(history)
        change_percentage = round(
            ((current_price - avg_historical) / avg_historical) * 100, 2)
        change_basis = "historical_average"
    else:
        change_percentage = 0.0
        change_basis = "none"

    # Step 4: Merge and return
    return {
        **current_result,
        "change_percentage": change_percentage,
        "change_basis": change_basis,
        "purchase_price": purchase_price,
        "price_history": {
            "history": history
        }
    }
