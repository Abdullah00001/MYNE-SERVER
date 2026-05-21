import asyncio
import csv
import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "luxurybags")
CSV_PATH = "data/bags.csv"
IMAGES_DIR = "data/images"
BASE_URL = "http://localhost:8000/images"  # change to CDN URL later

client = AsyncIOMotorClient(MONGODB_URI)
db = client[MONGODB_DB]
bags = db["bags"]


def normalize_brand(raw: str) -> str:
    """Fix encoding issues like HermÃ¨s → Hermès"""
    fixes = {
        "HermÃ¨s": "Hermès",
        "HermÃ©s": "Hermès",
    }
    return fixes.get(raw.strip(), raw.strip())


def find_image_url(image_name: str, brand: str) -> str | None:
    """Find image file and return its URL."""
    brand_folder = (
        brand.lower()
        .replace("è", "e")
        .replace("é", "e")
        .replace(" ", "_")
    )
    candidates = [
        os.path.join(IMAGES_DIR, brand_folder, f"{image_name}.jpg"),
        os.path.join(IMAGES_DIR, f"{image_name}.jpg"),
    ]
    for path in candidates:
        if os.path.exists(path):
            rel = os.path.relpath(path, IMAGES_DIR).replace("\\", "/")
            return f"{BASE_URL}/{rel}"
    return None


async def seed():
    # Clear old CSV data only
    await bags.delete_many({"source": "csv"})
    print("Cleared old CSV data.")

    inserted = 0
    skipped = 0

    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        for row in reader:
            brand = normalize_brand(row.get("brand", ""))
            model = row.get("model", "").strip()
            size = row.get("size", "").strip()
            color = row.get("color", "").strip()
            image_name = row.get("image_name", "").strip()
            alias_raw = row.get("alias_names", "").strip()

            if not brand or not model or not color:
                skipped += 1
                continue

            # e.g. "Birkin 25"
            full_model = f"{model} {size}".strip() if size else model

            # "Birkin 25; Birkin25" → ["Birkin 25", "Birkin25"]
            aliases = [a.strip() for a in alias_raw.split(";") if a.strip()]

            # find image
            image_url = find_image_url(
                image_name, brand) if image_name else None
            image_urls = [image_url] if image_url else []

            doc = {
                "brand":              brand,
                "family":             row.get("family", "").strip(),
                "model":              full_model,
                "size":               size,
                "style_variant":      row.get("style_variant", "").strip(),
                "color":              color,
                "color_family":       row.get("color_family", "").strip(),
                "leather":            row.get("leather", "").strip(),
                "hardware":           row.get("hardware", "").strip(),
                "category":           row.get("category", "").strip(),
                "aliases":            aliases,
                "image_name":         image_name,
                "image_urls":         image_urls,
                "estimated_value_eur": 0,
                "source":             "csv",
                "hit_count":          0,
            }

            await bags.update_one(
                {"brand": brand, "model": full_model, "color": color},
                {"$setOnInsert": doc},
                upsert=True
            )
            inserted += 1

    print(f"Done! {inserted} bags inserted, {skipped} rows skipped.")
    await client.close()


if __name__ == "__main__":
    asyncio.run(seed())
