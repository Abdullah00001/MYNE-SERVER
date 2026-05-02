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
    construction: str = ""
    special_variant: str = "Standard"
    purchase_price: Optional[float] = None   # ← add this


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
        construction=req.construction,
        special_variant=req.special_variant,
        purchase_price=req.purchase_price,   # ← add this
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