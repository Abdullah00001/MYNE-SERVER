import httpx
import json
import logging
import os
import time
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from pydantic import BaseModel, Field, ValidationError, field_validator
from app.config import OPENAI_API_KEY

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

BRAND_FILES = {
    "hermès": "hermes",
    "hermes": "hermes",
    "chanel": "chanel",
    "louis vuitton": "louis_vuitton",
    "dior": "dior",
    "bottega veneta": "bottega_veneta",
    "prada": "prada",
    "saint laurent": "saint_laurent",
    "celine": "celine",
    "céline": "celine",
    "gucci": "gucci",
    "loewe": "loewe",
    "fendi": "fendi",
    "valentino": "valentino",
    "balenciaga": "balenciaga",
    "givenchy": "givenchy",
    "burberry": "burberry",
    "miu miu": "miu_miu",
}

# Pydantic models for response validation


class BagMatch(BaseModel):
    rank: int = Field(..., ge=1, le=4)
    brand: str
    model: str
    confidence: int = Field(default=0, ge=0, le=100)
    confidenceLabel: str = Field(default="Low", pattern="^(High|Medium|Low)$")
    estimatedValueEUR: int = Field(default=0, ge=0)
    detectedVariant: Optional[str] = None
    detectedColor: str
    detectedLeather: str
    detectedHardware: str = Field(default="Not visible")
    detectedSize: str
    colorAccuracy: int = Field(default=0, ge=0, le=100)
    alternativeColors: List[str] = []
    detectedYear: Optional[str] = None
    stampLetter: Optional[str] = None
    specialNotes: str = Field(default="")
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
- detectedVariant: "Sellier"=rigid/outside stitch, "Retourne"=soft/inside stitch, "Pochette"=clutch. Null if not applicable.
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
  Standard bag: "{Brand} {Model} {Size} {Variant} {Color} {Leather} {Hardware}"
  Bi-color bag: "{Brand} {Model} {Size}HSS bicolor {PrimaryColor} {SecondaryColor}"
  HSS bag: "{Brand} {Model} {Size} HSS special order"
  Special Order: "{Brand} {Model} {Size} HSS special order {Color}"
  Exotic leather: "{Brand} {Model} {Size} {ExoticLeather} {Color}"
  Never put two colors side by side without "bicolor" between them.

Return ONLY this JSON shape:
{"matches":[
  {"rank":1,"brand":"Hermès","model":"Mini Kelly II Bi Color","confidence":93,"confidenceLabel":"High","estimatedValueEUR":28000,"detectedVariant":"Sellier","detectedColor":"Ultra Violet","detectedLeather":"Epsom","detectedHardware":"Palladium","detectedSize":"20","colorAccuracy":87,"alternativeColors":[
      "Bleu Nuit","Bleu Indigo"],"detectedYear":"2022-2023","stampLetter":"Z","specialNotes":"Standard","isSpecialOrder":false,"isExotic":false,"isBiColor":true,"isTriColor":false,"isHSS":false,"secondaryColor":"Bleu Encre","tertiaryColor":null,"condition":"New","analysis":"Brief expert description.","imageSearchQuery":"Hermès Mini Kelly II 20 Sellier HSS Bi color Ultra Violet and Bleu Encre Epsom Palladium "},
  {"rank":2,"brand":"...","model":"...","confidence":85,"confidenceLabel":"Medium","estimatedValueEUR":0,"detectedVariant":"...","detectedColor":"...","detectedLeather":"...","detectedHardware":"...","detectedSize":"...","colorAccuracy":78,"alternativeColors":["...","..."],"detectedYear":"...","stampLetter":null,"specialNotes":"...","isSpecialOrder":false,"isExotic":false,"isBiColor":false,"isTriColor":false,"isHSS":false,"secondaryColor":null,"tertiaryColor":null,"condition":"...","analysis":"...","imageSearchQuery":"..."},
  {"rank":3,"brand":"...","model":"...","confidence":70,"confidenceLabel":"Low","estimatedValueEUR":0,"detectedVariant":"...","detectedColor":"...","detectedLeather":"...","detectedHardware":"...","detectedSize":"...","colorAccuracy":75,"alternativeColors":["...","..."],"detectedYear":"...","stampLetter":null,"specialNotes":"...","isSpecialOrder":false,"isExotic":false,"isBiColor":false,"isTriColor":false,"isHSS":false,"secondaryColor":null,"tertiaryColor":null,"condition":"...","analysis":"...","imageSearchQuery":"..."},
  {"rank":4,"brand":"...","model":"...","confidence":60,"confidenceLabel":"Low","estimatedValueEUR":0,"detectedVariant":"...","detectedColor":"...","detectedLeather":"...","detectedHardware":"...","detectedSize":"...","colorAccuracy":71,"alternativeColors":[
      "...","..."],"detectedYear":"...","stampLetter":null,"specialNotes":"...","isSpecialOrder":false,"isExotic":false,"isBiColor":false,"isTriColor":false,"isHSS":false,"secondaryColor":null,"tertiaryColor":null,"condition":"...","analysis":"...","imageSearchQuery ":"..."}
]}

IMPORTANT: 4 matches always. Fill ALL fields with real detected values. Never use "..." as a value.'''


async def get_vision_data(photo_b64: str) -> Dict[str, Any]:
    """Get web detection hints and similar image URLs from Google Vision"""
    from app.config import GOOGLE_VISION_API_KEY

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"https://vision.googleapis.com/v1/images:annotate?key={GOOGLE_VISION_API_KEY}",
            json={
                "requests": [{
                    "image": {"content": photo_b64},
                    "features": [{"type": "WEB_DETECTION", "maxResults": 10}]
                }]
            }
        )
        response.raise_for_status()
        data = response.json()

    web = data["responses"][0].get("webDetection", {})

    # Extract best guess
    best_guess = ""
    if web.get("bestGuessLabels"):
        best_guess = web["bestGuessLabels"][0].get("label", "")

    # Extract top web entities (brand, model hints)
    entities = [
        e.get("description", "")
        for e in web.get("webEntities", [])
        if e.get("description")
    ]

    # Extract up to 4 similar image URLs
    similar_images = [
        img["url"]
        for img in web.get("visuallySimilarImages", [])[:4]
    ]

    # # Extract hints from partial match filenames
    # filename_hints = []
    # for page in web.get("pagesWithMatchingImages", []):
    #     for img in page.get("partialMatchingImages", []):
    #         url = img.get("url", "")
    #         filename = url.split("/")[-1].split("?")[0]  # remove query params
    #         filename = filename.replace(".jpg", "").replace(
    #             ".webp", "").replace("-", " ")
    #         if filename:
    #             filename_hints.append(filename)

    logger.info(f"Vision best guess: {best_guess}")
    logger.info(f"Vision entities: {entities[:5]}")
    logger.info(f"Vision similar images: {len(similar_images)}")

    return {
        "best_guess": best_guess,
        "entities": entities,
        "similar_images": similar_images,
        # "filename_hints": filename_hints[:3]
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
    logger.info(f"Raw brand detected: {raw}")

    # Direct lookup in BRAND_FILES
    brand_key = BRAND_FILES.get(raw)
    if brand_key:
        logger.info(f"Brand matched: {raw} -> {brand_key}")
        return brand_key

    # If no exact match, try partial match
    for brand_name, key in BRAND_FILES.items():
        if brand_name in raw or raw in brand_name:
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

    # STEP 1: Get Vision hints + image URLs
    vision_data = await get_vision_data(photos[0])
    similar_images = vision_data["similar_images"]

    # Log full vision result
    logger.info(f"Full vision data: {json.dumps(vision_data, indent=2)}")

    # Build hint string for GPT-4o
    hints = f"""Product context:
    - Category: {vision_data['best_guess']}
    - Labels: {', '.join(vision_data['entities'][:5])}"""

    logger.info(f"Vision hints: {hints}")

    # STEP 2: Load knowledge based on Vision brand hint
    brand_key = "unknown"
    for entity in vision_data["entities"]:
        entity_lower = entity.lower()
        for brand_name, key in BRAND_FILES.items():
            if brand_name in entity_lower:
                brand_key = key
                break
        if brand_key != "unknown":
            break

    logger.info(f"Brand from Vision: {brand_key}")

    # If Vision didn't find brand, run a cheap brand detection call
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
        for model in ["gpt-4o", "gpt-4o-mini"]:
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
            if model == "gpt-4o":
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

    # STEP 7: Attach image URLs
    # for i, match in enumerate(validated):
    #     match["imageUrl"] = similar_images[i] if i < len(
    #         similar_images) else ""
    #     match["thumbnailUrl"] = similar_images[i] if i < len(
    #         similar_images) else ""

    logger.info(
        f"Done in {time.time() - start_time:.2f}s | brand={brand_key} | photos={len(photos)}")
    return validated
