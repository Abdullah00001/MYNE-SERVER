from pydantic import BaseModel
from typing import List, Optional
import uuid
from fastapi import APIRouter, HTTPException, File, UploadFile
import base64
import asyncio
from bson import ObjectId
from datetime import datetime
from app.services.openai_service import identify_bag
from app.services.serp_service import fetch_bag_image
from app.services.price_service import get_full_valuation   # ← single entry point
from app.database import usercollections, db

router = APIRouter()


class ConfirmBagRequest(BaseModel):
    brand: str
    model: str
    color: str
    condition: str
    leather: str = ""
    hardware: str = ""
    size: str = ""
    special_variant: str = "Standard"


# ─────────────────────────────────────────
# IDENTIFY FROM PHOTO
# ─────────────────────────────────────────

@router.post("/identify/upload")
async def identify_upload(
    user_id: str = "anonymous",
    files: List[UploadFile] = File(...)
):
    # 1. Read uploaded files → base64
    photos = []
    photo_mimes = []
    for file in files:
        contents = await file.read()
        photos.append(base64.b64encode(contents).decode("utf-8"))
        photo_mimes.append(file.content_type)

    # 2. Call OpenAI Vision → up to 4 matches
    matches = await identify_bag(photos, photo_mimes)
    if not matches:
        raise HTTPException(status_code=422, detail="No matches returned")

    # 3. Fetch image for each match in parallel
    async def enrich_match(match):
        query = match.get("imageSearchQuery") or \
            f"{match.get('brand')} {match.get('model')} {match.get('detectedColor')}"
        image_data = await fetch_bag_image(query)
        return {
            **match,
            "thumbnailUrl": image_data.get("thumbnailUrl", ""),
            "imageUrl":     image_data.get("imageUrl", "")
        }

    enriched_matches = await asyncio.gather(*[enrich_match(m) for m in matches])

    return {
        "status": 200,
        "success": True,
        "data": {
            "user_id": user_id,
            "matches": enriched_matches
        }
    }


# ─────────────────────────────────────────
# CONFIRM + SAVE BAG
# ─────────────────────────────────────────

@router.post("/bags/confirm")
async def confirm_bag(
    user_id: str,
    brand: str,
    model: str,
    color: str,
    condition: str,
    leather: str = "",
    hardware: str = "",
    size: str = "",
    year: str = "",
    image_url: str = "",
    special_variant: str = "Standard",
    ai_matches: list = None
):
    ai_matches = ai_matches or []

    # 1. Get full valuation (current price + history)
    valuation = await get_full_valuation(
        brand=brand,
        model=model,
        color=color,
        leather=leather,
        hardware=hardware,
        size=size,
        condition=condition,
        special_variant=special_variant,
    )

    # 2. Resolve or create brand document
    brand_doc = await db["brands"].find_one({"name": {"$regex": brand, "$options": "i"}})
    if not brand_doc:
        brand_result = await db["brands"].insert_one({"name": brand, "created_at": datetime.utcnow()})
        brand_id = str(brand_result.inserted_id)
    else:
        brand_id = str(brand_doc["_id"])

    # 3. Resolve or create model document
    model_doc = await db["models"].find_one({"name": {"$regex": model, "$options": "i"}})
    if not model_doc:
        model_result = await db["models"].insert_one({
            "name": model,
            "brand_id": brand_id,
            "created_at": datetime.utcnow()
        })
        model_id = str(model_result.inserted_id)
    else:
        model_id = str(model_doc["_id"])

    # 4. Build and save bag document
    doc = {
        "brand_id":       brand_id,
        "model_id":       model_id,
        "user_id":        user_id,
        "primary_image":  image_url,
        "images":         [],
        "bag_color":      color,
        "leather_type":   leather,
        "hardware_color": hardware,
        "size":           size,
        "condition":      condition,
        "production_year": int(year[:4]) if year and year[:4].isdigit() else None,
        "price_status": {
            "current_value":      valuation.get("current_price", 0),
            "currency":           "EUR",
            "confidence":         valuation.get("confidence", "low"),
            "trend":              valuation.get("trend", "stable"),
            "trend_note":         valuation.get("trend_note", ""),
            "color_premium":      valuation.get("color_premium", False),
        },
        "price_history":          valuation.get("history", []),
        "price_sources":          valuation.get("sources_used", []),
        "price_data_points":      valuation.get("data_points", 0),
        "price_reasoning":        valuation.get("reasoning", ""),
        "last_price_updated_at":  datetime.utcnow(),
        "purchase_info":          None,
        "notes":                  None,
        "receipt":                None,
        "is_archived":            False,
        "publish_status":         "pending",
        "created_at":             datetime.utcnow(),
        "ai_matches":             ai_matches,
    }

    result = await usercollections.insert_one(doc)

    return {
        "status": 200,
        "success": True,
        "data": {
            "id":           str(result.inserted_id),
            "brand":        brand,
            "model":        model,
            "brand_id":     brand_id,
            "model_id":     model_id,
            "price_status": doc["price_status"],
            "price_history": doc["price_history"],
            "image_url":    image_url
        }
    }


# ─────────────────────────────────────────
# GET PRICE + HISTORY (standalone endpoint)
# ─────────────────────────────────────────

@router.post("/bags/price")
async def get_price(req: ConfirmBagRequest):
    """
    Returns current market price + 10-month price history for a bag.
    Does NOT save to database — use /bags/confirm for that.
    """
    valuation = await get_full_valuation(
        brand=req.brand,
        model=req.model,
        color=req.color,
        leather=req.leather,
        hardware=req.hardware,
        size=req.size,
        condition=req.condition,
        special_variant=req.special_variant,
    )

    return {
        "status": 200,
        "success": True,
        "data": valuation   # already has current_price + history + trend + reasoning
    }


# ─────────────────────────────────────────
# CRUD
# ─────────────────────────────────────────


@router.get("/health")
async def health():
    return {
        "status": 200,
        "success": True,
        "message": "Server Is Running",
        "traceId": str(uuid.uuid4())
    }