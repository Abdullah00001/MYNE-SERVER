import uuid
from fastapi import APIRouter, HTTPException, File, UploadFile, Request
import base64
import asyncio
import httpx
from app.services.openai_service import identify_bag
from app.services.serp_service import fetch_bag_image
# ← single entry point
from app.services.price_service import get_full_valuation, get_full_valuation_from_image
from app.database import usercollections, db
from app.services.serp_service_copy import fetch_prices_from_image

from pydantic import BaseModel, field_validator
from typing import List, Optional

router = APIRouter()


class ConfirmBagRequest(BaseModel):
    brand: str
    model: str
    color: List[str] = []
    condition: str
    leather: str = ""
    hardware: str = ""
    size: str = ""
    construction: str = ""
    special_variant: str = "Standard"
    purchase_price: Optional[float] = None
    image_search_query: Optional[str] = None

    @field_validator('color', mode='before')
    @classmethod
    def coerce_color(cls, v):
        if isinstance(v, str):
            return [v]
        return v
# ─────────────────────────────────────────
# IDENTIFY FROM PHOTO
# ─────────────────────────────────────────


@router.post("/identify/upload")
async def identify_upload(
    url: str,
    user_id: str = "anonymous",
):
    matches = await identify_bag(url)
    if not matches:
        raise HTTPException(status_code=422, detail="No matches returned")

    async def enrich_match(match):
        if match.get("rank") == 1:
            return match
        query = match.get("imageSearchQuery") or \
            f"{match.get('brand')} {match.get('model')}"
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
        image_search_query=req.image_search_query   # ← add this
    )

    return {
        "status": 200,
        "success": True,
        "data": valuation   # already has current_price + history + trend + reasoning
    }


class ImageUrlRequest(BaseModel):
    image_url: str
    image_search_query: str = ""
    purchase_price: Optional[float] = None


@router.post("/bags/price/by-image")
async def price_by_image(req: ImageUrlRequest):
    result = await get_full_valuation_from_image(
        image_url=req.image_url,
        purchase_price=req.purchase_price,
        image_search_query=req.image_search_query,
    )
    return {"status": 200, "success": True, "data": result}


@router.get("/health")
async def health():
    return {
        "status": 200,
        "success": True,
        "message": "Server Is Running",
        "traceId": str(uuid.uuid4())
    }


@router.post("/bags/price/debug")
async def debug_price(request: Request):
    body = await request.json()
    return {"received": body, "color_type": str(type(body.get("color")))}


@router.post("/identify/upload/stream")
async def identify_upload_stream(
    url: str,
    user_id: str = "anonymous",
):
    async def event_stream():
        # Step 1: identify
        matches = await identify_bag(url)
        if not matches:
            yield f"data: {json.dumps({'error': 'No matches'})}\n\n"
            return
 
        # Step 2: stream rank 1 immediately
        rank1 = matches[0]
        yield f"data: {json.dumps({'match': rank1, 'rank': 1})}\n\n"
 
        # Step 3: enrich ranks 2/3/4 in parallel, stream each as it finishes
        async def enrich_and_stream(match):
            query = match.get("imageSearchQuery") or \
                f"{match.get('brand')} {match.get('model')}"
            image_data = await fetch_bag_image(query)
            return {**match, "imageUrl": image_data.get("imageUrl", ""), "thumbnailUrl": image_data.get("thumbnailUrl", "")}
 
        tasks = [enrich_and_stream(m) for m in matches[1:]]
        for coro in asyncio.as_completed(tasks):
            enriched = await coro
            yield f"data: {json.dumps({'match': enriched, 'rank': enriched['rank']})}\n\n"
 
        yield "data: {\"done\": true}\n\n"
 
    return StreamingResponse(event_stream(), media_type="text/event-stream")
 