import re
from app.database import bags_collection
from datetime import datetime


async def find_bag_in_db(brand: str, model: str, color: str) -> dict | None:
    """
    Search MongoDB for a matching bag.
    Tries 3 levels:
    1. brand + model + color  (exact)
    2. brand + model          (color uncertain)
    3. brand + aliases        (model name variation)
    """
    queries = [
        # Level 1 — exact match
        {
            "brand": {"$regex": f"^{re.escape(brand)}$", "$options": "i"},
            "model": {"$regex": f"^{re.escape(model)}$", "$options": "i"},
            "color": {"$regex": f"^{re.escape(color)}$", "$options": "i"},
        },
        # Level 2 — brand + model only
        {
            "brand": {"$regex": f"^{re.escape(brand)}$", "$options": "i"},
            "model": {"$regex": f"^{re.escape(model)}$", "$options": "i"},
        },
        # Level 3 — brand + alias match
        {
            "brand":   {"$regex": f"^{re.escape(brand)}$", "$options": "i"},
            "aliases": {"$regex": re.escape(model), "$options": "i"},
        },
    ]

    for query in queries:
        doc = await bags_collection.find_one(query, sort=[("hit_count", -1)])
        if doc:
            await bags_collection.update_one(
                {"_id": doc["_id"]},
                {"$inc": {"hit_count": 1}}
            )
            doc["_id"] = str(doc["_id"])
            doc["match_source"] = "database"
            return doc

    return None


async def save_bag_to_db(match: dict) -> None:
    """Save a new AI result to MongoDB so next time it's a DB hit."""
    doc = {
        "brand":              match.get("brand"),
        "model":              match.get("model"),
        "color":              match.get("detectedColor"),
        "leather":            match.get("detectedLeather"),
        "hardware":           match.get("detectedHardware"),
        "size":               match.get("detectedSize"),
        "estimated_value_eur": match.get("estimatedValueEUR"),
        "condition":          match.get("condition"),
        "is_exotic":          match.get("isExotic", False),
        "is_special_order":   match.get("isSpecialOrder", False),
        "image_urls":         [],
        "analysis":           match.get("analysis"),
        "image_search_query": match.get("imageSearchQuery"),
        "source":             "ai",
        "created_at":         datetime.utcnow(),
        "hit_count":          0,
    }
    # Upsert — no duplicates
    await bags_collection.update_one(
        {
            "brand": doc["brand"],
            "model": doc["model"],
            "color": doc["color"],
        },
        {"$setOnInsert": doc},
        upsert=True
    )
