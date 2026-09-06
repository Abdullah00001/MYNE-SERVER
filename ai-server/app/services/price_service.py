import json
import httpx
from app.config import OPENAI_API_KEY
from app.services.serp_service import fetch_all_market_prices
from app.services.serp_service_copy import detect_currency_symbol, extract_price, fetch_prices_from_image, to_eur
from app.services.brand_config import get_brand_config

from datetime import date
from dateutil.relativedelta import relativedelta
from typing import List


today = date.today()
end_month = today.replace(day=1) - relativedelta(months=1)
start_month = end_month - relativedelta(months=11)

start_str = start_month.strftime("%b %Y")
end_str = end_month.strftime("%b %Y")

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
    color: List[str],
    leather: str,
    hardware: str,
    construction: str,
    size: str,
    condition: str,
    special_variant: str = "",
    image_search_query: str = "",
) -> dict:

    # ── Step 1: Real market data ──
    market = await fetch_all_market_prices(brand, model, size, leather, color, condition, construction, special_variant, image_search_query)

    resale_price = market["resale_price"]
    data_points = market["data_points"]

    config = get_brand_config(brand)
    is_investment = any(m in model.lower()
                        for m in config["investment_models"])

    # Build sources_used
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

    # ── Step 2: GPT estimates final value ──
    prompt = f"""
You are a luxury handbag pricing expert. Estimate the current resale market price in EUR for:

Brand: {brand}
Model: {model}
Color: {", ".join(color) if isinstance(color, list) else color}
Leather: {leather}
Hardware: {hardware}
Size: {size}
Condition: {condition}
Construction: {construction}
Special Variant: {special_variant}

Retail prices:   {market["retail_sources"]}
Reseller prices: {market["reseller_sources"]}
eBay prices:     {market["ebay_sources"]}
Total data points: {data_points}

Brand pricing rules:
- Brand type: {"Investment piece — resale often EXCEEDS retail, do not cap at retail price" if is_investment else "Depreciating brand — resale is typically 40-70% of retail"}

Condition adjustment guide:
- New: slight premium over Excellent
- Excellent: market baseline  
- Very Good: ~10-15% below Excellent
- Good: ~20-30% below Excellent
- Fair: ~35-45% below Excellent
- Poor: ~50-60% below Excellent
{"Note: for investment brands, condition affects price much less." if is_investment else ""}

Source trust order:
1. Reseller prices = most trusted
2. eBay prices = less trusted
3. Retail prices = new from boutique, NOT resale value

Return ONLY a JSON object:
    - current_value: number (EUR)
    - currency: "EUR"
    - confidence: "low" | "medium" | "high"
    - trend: "up" | "down" | "stable"
    - change_percentage: number
    - price_range: object with min and max (EUR)
    - retail_price: number (EUR)
    - color_premium: boolean
    """

    result = await call_gpt(prompt)

    # Override if GPT undershoots real market data
    if is_investment and resale_price:
        if (result.get("current_value") or 0) < resale_price * 0.92:
            result["current_value"] = resale_price
            result["confidence"] = "medium"
            print(
                f"[get_current_price] GPT undershot — overriding with resale median: {resale_price}")

    result["sources_used"] = sources_used or ["GPT-4o estimate"]
    result["data_points"] = data_points
    result["market_sources"] = {
        "retail": market["retail_sources"],
        "resellers": market["reseller_sources"],
        "ebay": market["ebay_sources"],
    }
    return result


# ─────────────────────────────────────────
# PRICE HISTORY (last 10 months)
# ─────────────────────────────────────────


async def get_price_history(
    brand: str,
    model: str,
    color: List[str],
    leather: str,
    size: str,
    current_price: float,
) -> list[dict]:
    """
    Today is {today}. Generate a realistic monthly price history for the LAST 12 MONTHS (not including current month).
    The history MUST start from {start_str} and end at {end_str}. Do not use any other date range.
    The prices should reflect real luxury market behavior:
    - Gradual appreciation or depreciation trends (not random jumps)
    - Seasonal effects if applicable (e.g. slower summer, stronger Q4)
    - Color/leather rarity premium if this is a sought-after combination
    - Month-to-month changes should be realistic: typically 1-4% max between adjacent months
    """

    today = date.today()
    end_month = today.replace(day=1) - relativedelta(months=1)
    start_month = end_month - relativedelta(months=11)
    start_str = start_month.strftime("%b %Y")
    end_str = end_month.strftime("%b %Y")

    prompt = f"""

    You are a luxury resale market analyst specializing in {brand} handbags.

    Today is {today}. Given that this bag is currently worth approximately {current_price} EUR:

    Brand: {brand}
    Model: {model}
    Color: {", ".join(color) if isinstance(color, list) else color}
    Leather: {leather}
    Size: {size}
    Current Price (today): {current_price} EUR

    Generate a realistic monthly price history for the LAST 12 MONTHS (not including current month) anchored to current_price..
    The history MUST start from {start_str} and end at {end_str}. Do not use any other date range.
    The prices should reflect real luxury market behavior:
    - Gradual appreciation or depreciation trends (not random jumps)
    - Seasonal effects if applicable (e.g. slower summer, stronger Q4)
    - Color/leather rarity premium if this is a sought-after combination
    - Month-to-month changes should be realistic: typically 1-4% max between adjacent months

    Return ONLY a JSON object with:
    - history: array of exactly 12 objects in chronological order, each with:
        - - period: string formatted as "Mon YYYY" e.g. "{start_str}", ... "{end_str}"
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
    color: List[str],
    leather: str,
    hardware: str,
    size: str,
    condition: str,
    construction: str,
    special_variant: str = "",
    purchase_price: float = None,
    image_search_query: str = "",   # ← add this
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
        image_search_query=image_search_query
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


def filter_outliers(prices: list[float], gpt_estimate: float = None) -> list[float | None]:
    if not prices:
        return prices

    sorted_p = sorted(prices)

    # ── Fix 10x typos FIRST ──────────────────────────────────────
    median = sorted_p[len(sorted_p) // 2]
    corrected = []
    for p in prices:
        if p * 10 > median * 0.7 and p * 10 < median * 1.3:
            print(f"[outlier] Auto-correcting likely typo: {p} → {p * 10}")
            corrected.append(p * 10)
        else:
            corrected.append(p)
    prices = corrected

    # ── Check spread ─────────────────────────────────────────────
    sorted_p = sorted(prices)
    spread_ratio = sorted_p[-1] / sorted_p[0] if sorted_p[0] > 0 else 1
    if spread_ratio > 3:
        print(
            f"[outlier] High spread ({spread_ratio:.1f}x) — using GPT estimate only")
        if gpt_estimate and gpt_estimate > 0:
            # None = drop this price, keep index alignment
            return [p if 0.4 * gpt_estimate <= p <= 1.6 * gpt_estimate else None for p in prices]
        return prices

    # ── IQR ──────────────────────────────────────────────────────
    if len(prices) >= 4:
        q1 = sorted_p[len(sorted_p) // 4]
        q3 = sorted_p[(3 * len(sorted_p)) // 4]
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        filtered = [p if lower <= p <= upper else None for p in prices]
    else:
        median = sorted_p[len(sorted_p) // 2]
        filtered = [p if 0.6 * median <= p <=
                    1.4 * median else None for p in prices]

    # ── GPT cross-check ──────────────────────────────────────────
    if gpt_estimate and gpt_estimate > 0:
        filtered = [
            p if (p is not None and 0.4 * gpt_estimate <=
                  p <= 1.6 * gpt_estimate) else None
            for p in filtered
        ]

    dropped = [prices[i] for i, p in enumerate(filtered) if p is None]
    if dropped:
        print(f"[outlier] Dropped: {dropped}")

    # Never return all-None — fall back to corrected prices
    valid = [p for p in filtered if p is not None]
    return filtered if valid else prices


async def get_full_valuation_from_image(
    image_url: str,
    purchase_price: float = None,
    image_search_query: str = "",
) -> dict:

    # Step 1 — get prices from image
    market = await fetch_prices_from_image(image_url, image_search_query)

    resale_price = market.get("resale_price") or 0
    sources = market.get("sources", [])
    reference_sources = market.get("reference_sources", [])

    # ── Clean sources EARLY, before anything else sees them ──────
    if sources:
        raw_prices = [s["eur"] for s in sources]
        clean_prices = filter_outliers(raw_prices)

        # pair each source with its corrected price
        sources = [
            {**s, "eur": clean_prices[i]}   # overwrite with corrected price
            for i, s in enumerate(sources)
            if clean_prices[i] is not None   # None means dropped
        ]

        sorted_clean = sorted([s["eur"] for s in sources])
        resale_price = sorted_clean[len(sorted_clean) // 2]

        sorted_clean = sorted([s["eur"] for s in sources])
        resale_price = sorted_clean[len(sorted_clean) // 2]

    # Step 2 — GPT estimates final value from those prices
    title = image_search_query if image_search_query else (
        sources[0]["title"] if sources else "")
    brand_raw = title.split()[0] if title else ""
    brand_key = brand_raw.lower().replace("è", "e").replace("é", "e").strip()
    config = get_brand_config(brand_key)
    is_investment = any(m in title.lower()
                        for m in config.get("investment_models", []))

    # Build confidence hint based on data quality
    if len(sources) >= 5:
        confidence_hint = "high"
    elif sources or reference_sources:
        confidence_hint = "medium"
    else:
        confidence_hint = "low"

    # Build price context
    if sources:
        src_items = [
            f"- {s['title']}: €{s['eur']} ({s['source']})" for s in sources]
        price_context = f"""
    Exact market prices found for this bag:
    {chr(10).join(src_items)}
    Median resale price: €{resale_price}
    Use these as your PRIMARY anchor.
    """
    elif reference_sources:
        ref_items = []
        for r in reference_sources:
            price = extract_price(r["price_raw"])
            symbol = detect_currency_symbol(r["price_raw"])
            eur = to_eur(price, symbol) if price else "unknown"
            ref_items.append(f"- {r['title']}: €{eur} ({r['source']})")

        price_context = f"""
    No exact match found for "{title}".
    Below are prices for visually similar bags (may be different size/model) — use as calibration reference only:
    {chr(10).join(ref_items)}
    Adjust your estimate based on the size and model difference between these and the target bag.
    Do NOT copy these prices directly.
    """
    else:
        price_context = f"""
    No market data found from image search.
    Use your expert knowledge of current resale market prices for "{title}" 
    as seen on Vestiaire, 1stDibs, TheRealReal etc. in {today}.
    """

    prompt = f"""
    Today is {today}.
    You are a luxury handbag pricing expert. Estimate the current resale market price in EUR.

    Bag identified as: "{title}"

    {price_context}

    Brand pricing rules:
    - Brand type: {"Investment piece — resale often EXCEEDS retail, do not cap at retail price" if is_investment else "Depreciating brand — resale is typically 40-70% of retail"}

    Source trust order:
    1. Reseller prices = most trusted
    2. eBay prices = less trusted  
    3. Retail prices = new from boutique, NOT resale value

    Data quality: {"Exact market prices found" if sources else "Similar bag prices used as reference" if reference_sources else "Pure knowledge estimate — no market data"}
    Set confidence to "{confidence_hint}".

    Return ONLY a JSON object:
    - current_value: number (EUR)
    - currency: "EUR"
    - confidence: "{confidence_hint}"
    - trend: "up" | "down" | "stable"
    - price_range: object with min and max (EUR)
    - retail_price: number (EUR)
    - color_premium: boolean
    """

    gpt_result = await call_gpt(prompt)

    # override if GPT undershoots real market data
    if is_investment and resale_price:
        if (gpt_result.get("current_value") or 0) < resale_price * 0.92:
            gpt_result["current_value"] = resale_price
            gpt_result["confidence"] = "medium"
            print(
                f"[get_full_valuation_from_image] GPT undershot — overriding with: {resale_price}")

# override price_range with actual values from sources
    if sources:
        # 1. EXTRACT: Pull the raw prices directly from your active 'sources' list
        prices_eur = [s["eur"] for s in sources if s.get("eur") is not None]

        # 2. FILTER: Clean outliers based on the GPT estimate if available
        gpt_estimate = gpt_result.get("current_value")
        filtered_prices = filter_outliers(prices_eur, gpt_estimate)
        # 3. SANITIZE: Remove any 'None' entries dropped by filter_outliers
        clean_prices = [p for p in filtered_prices if p is not None]

        # 4. SAFE COMPUTE: Make sure we have numbers left before calling min/max
        if clean_prices:
            gpt_result["price_range"] = {
                "min": min(clean_prices),
                "max": max(clean_prices)
            }
        else:
            # Fallback if everything got dropped by the outlier filter
            gpt_result["price_range"] = {
                "min": gpt_estimate * 0.8 if gpt_estimate else 0,
                "max": gpt_estimate * 1.2 if gpt_estimate else 0
            }

    # Step 3 — price history
    current_value = gpt_result.get("current_value", resale_price)
    history_result = await get_price_history(
        brand=brand_raw,
        model=title,
        color=[],
        leather="",
        size="",
        current_price=current_value,
    )
    history = history_result.get("history", [])

    # Step 4 — change percentage
    if purchase_price and purchase_price > 0:
        change_percentage = round(
            ((current_value - purchase_price) / purchase_price) * 100, 2)
        change_basis = "purchase_price"
    elif history:
        avg_historical = sum(h["avg_price"] for h in history) / len(history)
        change_percentage = round(
            ((current_value - avg_historical) / avg_historical) * 100, 2)
        change_basis = "historical_average"
    else:
        change_percentage = 0.0
        change_basis = "none"

    return {
        **gpt_result,
        "data_points": len(sources),
        "sources_used": [{"type": "Organic Search", "sites": [s["source"] for s in sources]}],
        "market_sources": {"Search_Results": sources},
        "change_percentage": change_percentage,
        "change_basis": change_basis,
        "purchase_price": purchase_price,
        "price_history": {"history": history}
    }