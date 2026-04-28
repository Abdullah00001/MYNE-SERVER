from app.services.bag_db_service import find_bag_in_db, save_bag_to_db
from app.services.openai_service import identify_bag


async def identify_bag_smart(photos: list, photo_mimes: list) -> dict:
    """
    DB-first identification:
    1. Run AI to get brand/model/color
    2. Check MongoDB for a known match
    3. If found → enrich with DB data (images, price)
    4. If not found → save AI result for next time
    """

    # Step 1 — AI identification
    ai_matches = await identify_bag(photos, photo_mimes)

    if not ai_matches:
        return {"matches": [], "source": "ai", "dbHit": False}

    top = ai_matches[0]
    brand = top.get("brand", "")
    model = top.get("model", "")
    color = top.get("detectedColor", "")

    # Step 2 — check MongoDB
    db_result = await find_bag_in_db(brand, model, color)

    if db_result:
        # Step 3 — enrich AI result with DB data
        top["imageUrls"] = db_result.get("image_urls", [])
        top["estimatedValueEUR"] = db_result.get(
            "estimated_value_eur") or top["estimatedValueEUR"]
        top["matchSource"] = "database"
        ai_matches[0] = top
        return {"matches": ai_matches, "source": "database", "dbHit": True}

    # Step 4 — new bag, cache it
    await save_bag_to_db(top)

    return {"matches": ai_matches, "source": "ai", "dbHit": False}
