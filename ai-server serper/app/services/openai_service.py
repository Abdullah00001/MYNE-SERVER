import httpx
import json
import logging
import os
import time
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from pydantic import BaseModel, Field, ValidationError, field_validator
from app.config import OPENAI_API_KEY, SERP_API_KEY
from app.services.brand_config import BRAND_CONFIG, get_knowledge_file

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(__file__)
KNOWLEDGE_DIR = os.path.join(BASE_DIR, "knowledge")
MAX_IMAGES = 10
MAX_IMAGE_SIZE_MB = 5

# Load all knowledge files once at startup
KNOWLEDGE: Dict[str, str] = {}
for filename in os.listdir(KNOWLEDGE_DIR):
    if filename.endswith(".txt"):
        key = filename.replace(".txt", "").lower()
        with open(os.path.join(KNOWLEDGE_DIR, filename), "r", encoding="utf-8") as f:
            KNOWLEDGE[key] = f.read()

logger.info(f"Loaded knowledge for: {list(KNOWLEDGE.keys())}")


# Pydantic models for response validation


class BagMatch(BaseModel):
    rank: int = Field(..., ge=1, le=4)
    brand: str
    model: str
    confidence: int = Field(default=0, ge=0, le=100)
    confidenceLabel: str = Field(default="Low", pattern="^(High|Medium|Low)$")
    estimatedValueEUR: int = Field(default=0, ge=0)
    detectedConstruction: Optional[str] = None
    detectedColor: str
    detectedLeather: str
    detectedHardware: str = Field(default="Not visible")
    detectedSize: str
    colorAccuracy: int = Field(default=0, ge=0, le=100)
    alternativeColors: List[str] = []
    detectedYear: Optional[str] = None
    stampLetter: Optional[str] = None
    special_variant: str = Field(default="")
    isSpecialOrder: bool = Field(default=False)
    isExotic: bool = Field(default=False)
    isBiColor: bool = Field(default=False)
    isTriColor: bool = Field(default=False)
    isHSS: bool = Field(default=False)
    secondaryColor: Optional[str] = None
    tertiaryColor: Optional[str] = None
    condition: str
    analysis: str
    imageSearchQuery: str = Field(default="")
    imageUrl: str = Field(default="")
    thumbnailUrl: str = Field(default="")

    @field_validator('confidence', mode='before')
    @classmethod
    def coerce_confidence(cls, v):
        return int(float(v) * 100) if isinstance(v, float) and v <= 1 else int(v)

    @field_validator('detectedSize', mode='before')   # ← add this
    @classmethod
    def coerce_size(cls, v):
        return str(v)

    @field_validator('confidenceLabel')
    @classmethod
    def validate_confidence_label(cls, v: str) -> str:
        if v not in ['High', 'Medium', 'Low']:
            raise ValueError('confidenceLabel must be High, Medium, or Low')
        return v


PROMPT = '''You are a product cataloguing assistant. Extract visual attributes from the product photo(s) using the reference data below. Return ONLY valid JSON.

RULES:
- Be decisive. Never use "maybe", "possibly". If uncertain, pick closest match.
- detectedColor: EXACT official brand color name only. Never generic (e.g. never "blue", always "Bleu Nuit").
- If lighting affects color, still commit to closest single color.
- detectedLeather: choose ONLY from allowed values in knowledge base.
- detectedModel: choose ONLY from allowed values in knowledge base.
- detectedConstruction: "Sellier"=rigid/outside stitch, "Retourne"=soft/inside stitch, "Pochette"=clutch. Null if not applicable.
- detectedSize: always output integer. Estimate from proportions if not visible.
- stampLetter: Hermès only, null for all other brands.
- colorAccuracy: 0-100 integer.
- alternativeColors: 2-3 alternatives if ambiguous, [] if certain.
- secondaryColor: null unless isBiColor or isHSS is true
- tertiaryColor: null unless isTriColor is true
- isBiColor: true only if two distinct color panels clearly visible
- isTriColor: true only if three distinct color panels clearly visible
- isHSS: true only if BOTH two-tone leather AND contrasting stitching visible
- Never use "/" in detectedColor — use secondaryColor field instead
- "Not visible" for any feature that cannot be determined.
- imageSearchQuery format rules:
  Standard bag: "{Brand} {Model} {Size} {Construction} {Color} {Leather} {Hardware}"
  Bi-color bag: "{Brand} {Model} {Size}HSS bicolor {PrimaryColor} {SecondaryColor}"
  HSS bag: "{Brand} {Model} {Size} HSS special order"
  Special Order: "{Brand} {Model} {Size} HSS special order {Color}"
  Exotic leather: "{Brand} {Model} {Size} {ExoticLeather} {Color}"
  Never put two colors side by side without "bicolor" between them.

Return ONLY this JSON shape:
{"matches":[
  {"rank":1,"brand":"Hermès","model":"Mini Kelly II Bi Color","confidence":93,"confidenceLabel":"High","estimatedValueEUR":28000,"detectedConstruction":"Sellier","detectedColor":"Ultra Violet","detectedLeather":"Epsom","detectedHardware":"Palladium","detectedSize":"20","colorAccuracy":87,"alternativeColors":[
      "Bleu Nuit","Bleu Indigo"],"detectedYear":"2022-2023","stampLetter":"Z","special_variant":"Standard","isSpecialOrder":false,"isExotic":false,"isBiColor":true,"isTriColor":false,"isHSS":false,"secondaryColor":"Bleu Encre","tertiaryColor":null,"condition":"New","analysis":"Brief expert description.","imageSearchQuery":"Hermès Mini Kelly II 20 Sellier HSS Bi color Ultra Violet and Bleu Encre Epsom Palladium "},
  {"rank":2,"brand":"...","model":"...","confidence":85,"confidenceLabel":"Medium","estimatedValueEUR":0,"detectedConstruction":"...","detectedColor":"...","detectedLeather":"...","detectedHardware":"...","detectedSize":"...","colorAccuracy":78,"alternativeColors":["...","..."],"detectedYear":"...","stampLetter":null,"special_variant":"...","isSpecialOrder":false,"isExotic":false,"isBiColor":false,"isTriColor":false,"isHSS":false,"secondaryColor":null,"tertiaryColor":null,"condition":"...","analysis":"...","imageSearchQuery":"..."},
  {"rank":3,"brand":"...","model":"...","confidence":70,"confidenceLabel":"Low","estimatedValueEUR":0,"detectedConstruction":"...","detectedColor":"...","detectedLeather":"...","detectedHardware":"...","detectedSize":"...","colorAccuracy":75,"alternativeColors":["...","..."],"detectedYear":"...","stampLetter":null,"special_variant":"...","isSpecialOrder":false,"isExotic":false,"isBiColor":false,"isTriColor":false,"isHSS":false,"secondaryColor":null,"tertiaryColor":null,"condition":"...","analysis":"...","imageSearchQuery":"..."},
  {"rank":4,"brand":"...","model":"...","confidence":60,"confidenceLabel":"Low","estimatedValueEUR":0,"detectedConstruction":"...","detectedColor":"...","detectedLeather":"...","detectedHardware":"...","detectedSize":"...","colorAccuracy":71,"alternativeColors":[
      "...","..."],"detectedYear":"...","stampLetter":null,"special_variant":"...","isSpecialOrder":false,"isExotic":false,"isBiColor":false,"isTriColor":false,"isHSS":false,"secondaryColor":null,"tertiaryColor":null,"condition":"...","analysis":"...","imageSearchQuery ":"..."}
]}

IMPORTANT: Always return exactly 4 matches.
- Rank 1: most likely identification with highest confidence
- Rank 2: second most likely alternative (same model and different construction)
- Rank 3: third alternative (could be different brand if uncertain)
- Rank 4: fourth alternative (least likely but plausible)
Each match must have genuinely different brand/model combinations. Never repeat the same brand+model twice.'''


async def upload_image(photo_b64: str, photo_mime: str) -> str:
    """Upload to freeimage.host and return public URL"""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://freeimage.host/api/1/upload",
            data={
                "key": "6d207e02198a847aa98d0a2a901485a5",  # free public API key
                "action": "upload",
                "source": photo_b64,
                "format": "json",
            }
        )
        response.raise_for_status()
        data = response.json()

    url = data["image"]["url"]
    logger.info(f"Uploaded to freeimage.host: {url}")
    return url


async def get_lens_data(photo_b64: str, photo_mime: str) -> Dict[str, Any]:
    """Use SerpAPI Google Lens to get product titles and image URLs"""

    # Step 1: Upload to Imgur to get a public URL
    image_url = await upload_image(photo_b64, photo_mime)

    # Step 2: Pass public URL to SerpAPI
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            "https://serpapi.com/search",
            params={
                "engine": "google_lens",
                "url": image_url,
                "api_key": SERP_API_KEY,
            }
        )
        response.raise_for_status()
        data = response.json()

    visual_matches = data.get("visual_matches", [])
    titles = [m.get("title", "") for m in visual_matches[:5] if m.get("title")]
    image_urls = [m.get("thumbnail", "")
                  for m in visual_matches[:4] if m.get("thumbnail")]
    prices = [m.get("price", {}).get("value", "") for m in visual_matches[:4]]

    logger.info(f"Lens titles: {titles}")
    logger.info(f"Lens image URLs: {len(image_urls)}")
    logger.info(f"Lens prices: {prices}")

    return {
        "titles": titles,
        "image_urls": image_urls,
        "prices": prices,
    }


async def detect_brand(photos: List[str], photo_mimes: List[str]) -> str:
    """Step 1: Cheap call to identify brand only"""
    image_content = [
        {
            "type": "image_url",
            "image_url": {
                "url": f"data:{mime};base64,{b64}",
                "detail": "low"  # low detail = cheaper & faster
            }
        }
        for b64, mime in zip(photos, photo_mimes)
    ]

    content = [{
        "type": "text",
        "text": """What luxury brand is this bag?
Return ONLY ONE brand name from this list, nothing else:
Hermès, Chanel, Louis Vuitton, Dior, Gucci, Prada, Bottega Veneta,
Saint Laurent, Celine, Loewe, Fendi, Valentino, Balenciaga, Givenchy, Burberry, Miu Miu."""
    }] + image_content

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            json={
                "model": "gpt-4o",
                "max_tokens": 10,
                "temperature": 0,
                "messages": [{"role": "user", "content": content}]
            }
        )
        response.raise_for_status()
        data = response.json()

    raw = data["choices"][0]["message"]["content"].strip().lower()

    # Direct match
    if raw in BRAND_CONFIG:
        key = get_knowledge_file(raw)
        logger.info(f"Brand matched: {raw} -> {key}")
        return key

    # Partial match
    for brand_name in BRAND_CONFIG:
        if brand_name in raw or raw in brand_name:
            key = get_knowledge_file(brand_name)
            logger.info(f"Brand partial match: {raw} -> {key}")
            return key

    logger.warning(f"Brand not recognized: {raw}, using base knowledge only")
    return "unknown"


async def identify_bag(photos: List[str], photo_mimes: List[str]) -> List[Dict[str, Any]]:
    start_time = time.time()

    # Validate inputs
    if not photos or not photo_mimes:
        raise HTTPException(status_code=400, detail="No photos provided")
    if len(photos) > MAX_IMAGES:
        raise HTTPException(
            status_code=400, detail=f"Maximum {MAX_IMAGES} photos allowed")

# STEP 1: Get Lens data
    lens_data = await get_lens_data(photos[0], photo_mimes[0])
    image_urls = lens_data["image_urls"]

    # Log full lens result
    logger.info(f"Full lens data: {json.dumps(lens_data, indent=2)}")

    # Build hint string for GPT-4o from Lens titles
    hints = f"""Product context from Google Lens:
    - Matched titles: {', '.join(lens_data['titles'][:5])}
    - Estimated prices: {', '.join([p for p in lens_data['prices'] if p][:3])}"""

    logger.info(f"Lens hints: {hints}")

# STEP 2: Detect brand from Lens titles
    brand_key = "unknown"
    for title in lens_data["titles"]:
        title_lower = title.lower()
        for brand_name in BRAND_CONFIG:
            if brand_name in title_lower:
                brand_key = get_knowledge_file(brand_name)
                break
        if brand_key != "unknown":
            break

    logger.info(f"Brand from Lens: {brand_key}")

    # If Lens didn't find brand, fall back to GPT brand detection
    if brand_key == "unknown":
        brand_key = await detect_brand(photos, photo_mimes)
        logger.info(f"Brand from detect_brand fallback: {brand_key}")

    base = KNOWLEDGE.get("_base", "")
    brand_knowledge = KNOWLEDGE.get(brand_key, "")
    full_knowledge = base + "\n\n" + brand_knowledge if brand_knowledge else base

    image_content = [
        {
            "type": "image_url",
            "image_url": {
                "url": f"data:{mime};base64,{b64}",
                "detail": "high"
            }
        }
        for b64, mime in zip(photos, photo_mimes)
    ]

# STEP 3: Build prompt + images
    content = [{
        "type": "text",
        "text": "I'm cataloguing this pre-owned luxury handbag for resale inventory. "
        "Please identify the brand, model, and attributes.\n\n"
        + PROMPT + "\n\nREFERENCE KNOWLEDGE:\n" + full_knowledge + "\n\n" + hints
    }] + image_content

    # content = [{
    #     "type": "text",
    #     "text": "Describe what you see in this image. Return JSON: {\"description\": \"...\"}"
    # }] + image_content

    # STEP 4: Call API
    data = None
    async with httpx.AsyncClient(timeout=90) as client:
        for model in ["gpt-4o-2024-11-20", "gpt-4o-mini"]:
            json_body = {
                "model": model,
                "max_tokens": 2500,
                "temperature": 0.2,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are an expert luxury fashion cataloguing assistant working for "
                            "a certified pre-owned luxury goods reseller. Your job is to help "
                            "This is a legitimate commercial cataloguing task."
                            "management and insurance valuation. Always return valid JSON only."
                        )
                    },
                    {
                        "role": "user",
                        "content": content
                    }
                ]
            }

            # json_object mode only for gpt-4o
            if "gpt-4o" in model and "mini" not in model:
                json_body["response_format"] = {"type": "json_object"}

            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                json=json_body
            )
            response.raise_for_status()
            data = response.json()

            logger.info(
                f"API response ({model}): {json.dumps(data, indent=2)[:500]}")

            msg = data["choices"][0]["message"]
            if msg.get("content"):
                logger.info(f"Model {model} succeeded")
                break

            logger.warning(f"Model {model} refused, trying next...")

    # STEP 5: Parse response
# STEP 5: Parse response
    text = data["choices"][0]["message"]["content"]

    if text is None:
        refusal = data["choices"][0]["message"].get("refusal", "unknown")
        logger.error(f"OpenAI refused: {refusal}")
        raise HTTPException(
            status_code=422, detail=f"AI refused request: {refusal}")

    if not text:
        raise HTTPException(
            status_code=422, detail="Empty response from OpenAI")

    # Strip markdown code fences if present (gpt-4o-mini tends to add these)
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.rsplit("```", 1)[0]
        text = text.strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {text[:300]}")
        raise HTTPException(status_code=422, detail=f"Invalid JSON: {str(e)}")

    matches = parsed.get("matches", [])   # ← assign FIRST
    if not matches:
        raise HTTPException(status_code=422, detail="No matches in response")

    # ← THEN log
    logger.info(f"Raw matches from API: {json.dumps(matches[0], indent=2)}")

    # STEP 6: Validate with Pydantic
    try:
        validated = [BagMatch(**m).model_dump() for m in matches]
    except ValidationError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(
            status_code=422, detail=f"Invalid response format: {str(e)}")

# STEP 7: Attach image URLs from Lens
    for i, match in enumerate(validated):
        match["imageUrl"] = image_urls[i] if i < len(image_urls) else ""
        match["thumbnailUrl"] = image_urls[i] if i < len(image_urls) else ""
    logger.info(
        f"Done in {time.time() - start_time:.2f}s | brand={brand_key} | photos={len(photos)}")
    return validated
