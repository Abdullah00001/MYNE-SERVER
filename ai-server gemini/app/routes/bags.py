from pydantic import BaseModel
from typing import List
import uuid
from fastapi import APIRouter, HTTPException, File, UploadFile
import base64
import asyncio
from bson import ObjectId
from datetime import datetime
from app.services.openai_service import identify_bag
from app.services.serp_service import fetch_bag_image, fetch_price_history_serp
from app.services.price_service import fetch_fresh_price
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

    # 2. Call OpenAI → 4 matches
    matches = await identify_bag(photos, photo_mimes)
    if not matches:
        raise HTTPException(status_code=422, detail="No matches returned")

    # 3. Fetch image for each match in parallel
    async def enrich_match(match):
        query = match.get(
            "imageSearchQuery") or f"{match.get('brand')} {match.get('model')} {match.get('detectedColor')}"
        image_data = await fetch_bag_image(query)
        return {
            **match,
            "thumbnailUrl": image_data.get("thumbnailUrl", ""),
            "imageUrl": image_data.get("imageUrl", "")
        }

    enriched_matches = []
    # for m in matches:
    #     enriched = await enrich_match(m)
    #     enriched_matches.append(enriched)
    #     await asyncio.sleep(0.3)

    enriched_matches = await asyncio.gather(*[enrich_match(m) for m in matches])

    return {
        "status": 200,
        "success": True,
        "data": {
            "user_id": user_id,
            "matches": enriched_matches  # 4 matches, each with image_url
        }
    }


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
    ai_matches: list = None
    # then inside: ai_matches = ai_matches or []
):
    # 1. Fetch price now that user has selected
    price_data = await fetch_fresh_price(brand, model, color, condition)

    # 2. Resolve or create brand/model
    brand_doc = await db["brands"].find_one({"name": {"$regex": brand, "$options": "i"}})
    if not brand_doc:
        brand_result = await db["brands"].insert_one({"name": brand, "created_at": datetime.utcnow()})
        brand_id = str(brand_result.inserted_id)
    else:
        brand_id = str(brand_doc["_id"])

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

    # 3. Save bag
    doc = {
        "brand_id": brand_id,
        "model_id": model_id,
        "user_id": user_id,
        "primary_image": image_url,
        "images": [],
        "bag_color": color,
        "leather_type": leather,
        "hardware_color": hardware,
        "size": size,
        "price_status": {
            # ✅ Use .get() with defaults
            "trend": price_data.get("trend", "stable"),
            "change_percentage": price_data.get("change_percentage", 0),
            "current_value": price_data.get("current_value", 0),
            "currency": price_data.get("currency", "EUR")
        },
        "production_year": int(year[:4]) if year and year[:4].isdigit() else None,
        "condition": condition,
        "purchase_info": None,
        "notes": None,
        "receipt": None,
        "is_archived": False,
        "publish_status": "pending",
        "last_price_updated_at": datetime.utcnow(),
        "created_at": datetime.utcnow(),
        "ai_matches": ai_matches,
        "price_source": price_data.get("source"),
        "price_sample_count": price_data.get("sample_count"),
        "price_range": price_data.get("price_range")
    }

    result = await usercollections.insert_one(doc)

    return {
        "status": 200,
        "success": True,
        "data": {
            "id": str(result.inserted_id),
            "brand": brand,
            "model": model,
            "brand_id": brand_id,
            "model_id": model_id,
            "price_status": doc["price_status"],
            "price_source": price_data.get("source"),
            "price_range": price_data.get("price_range"),
            "image_url": image_url
        }
    }


@router.get("/bags")
async def list_bags():
    bags = []
    async for bag in usercollections.find(
        {"is_archived": False}
    ).sort("created_at", -1).limit(50):
        bag["id"] = str(bag["_id"])
        del bag["_id"]
        bags.append(bag)
    return {"status": 200, "success": True, "data": bags}


@router.get("/bags/{bag_id}")
async def get_bag(bag_id: str):
    bag = await usercollections.find_one({"_id": ObjectId(bag_id)})
    if not bag:
        raise HTTPException(status_code=404, detail="Bag not found")
    bag["id"] = str(bag["_id"])
    del bag["_id"]
    return {"status": 200, "success": True, "data": bag}


@router.delete("/bags/{bag_id}")
async def delete_bag(bag_id: str):
    result = await usercollections.delete_one({"_id": ObjectId(bag_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bag not found")
    return {"status": 200, "success": True, "deleted": True}


@router.get("/health")
async def health():
    return {
        "status": 200,
        "success": True,
        "message": "Server Is Running",
        "traceId": str(uuid.uuid4())
    }


@router.post("/bags/price")
async def get_price(req: ConfirmBagRequest):
    # 1. fetch current price first
    price_data = await fetch_fresh_price(
        req.brand, req.model, req.color, req.condition,
        req.leather, req.hardware, req.size
    )

    # 2. then fetch history using current price
    history_data = await fetch_price_history_serp(
        req.brand, req.model, req.color,
        req.leather, req.size, req.condition,
        current_price=price_data["current_value"]
    )

    return {
        "status": 200,
        "success": True,
        "data": {
            **price_data,
            "price_history": history_data
        }
    }
