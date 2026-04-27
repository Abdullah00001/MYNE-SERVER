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
    estimatedPriceEUR: int = Field(default=0, ge=0)
    detectedVariant: Optional[str] = None
    detectedColor: str
    detectedLeather: str
    detectedHardware: str = Field(default="Not visible")
    detectedSize: str
    colorAccuracy: int = Field(default=0, ge=0, le=100)
    alternativeColors: List[str] = []
    detectedYear: Optional[str] = None
    stampLetter: Optional[str] = None
    specialNotes: str
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

    @field_validator('confidence', mode='before')
    @classmethod
    def coerce_confidence(cls, v):
        return int(float(v) * 100) if isinstance(v, float) and v <= 1 else int(v)

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
  {"rank":1,"brand":"Hermès","model":"Mini Kelly II Bi Color","confidence":93,"confidenceLabel":"High","estimatedPriceEUR":28000,"detectedVariant":"Sellier","detectedColor":"Ultra Violet","detectedLeather":"Epsom","detectedHardware":"Palladium","detectedSize":"20","colorAccuracy":87,"alternativeColors":[
      "Bleu Nuit","Bleu Indigo"],"detectedYear":"2022-2023","stampLetter":"Z","specialNotes":"Standard","isSpecialOrder":false,"isExotic":false,"isBiColor":true,"isTriColor":false,"isHSS":false,"secondaryColor":"Bleu Encre","tertiaryColor":null,"condition":"New","analysis":"Brief expert description.","imageSearchQuery":"Hermès Mini Kelly II 20 Sellier HSS Bi color Ultra Violet and Bleu Encre Epsom Palladium "},
  {"rank":2,"brand":"...","model":"...","confidence":85,"confidenceLabel":"Medium","estimatedPriceEUR":0,"detectedVariant":"...","detectedColor":"...","detectedLeather":"...","detectedHardware":"...","detectedSize":"...","colorAccuracy":78,"alternativeColors":["...","..."],"detectedYear":"...","stampLetter":null,"specialNotes":"...","isSpecialOrder":false,"isExotic":false,"isBiColor":false,"isTriColor":false,"isHSS":false,"secondaryColor":null,"tertiaryColor":null,"condition":"...","analysis":"...","imageSearchQuery":"..."},
  {"rank":3,"brand":"...","model":"...","confidence":70,"confidenceLabel":"Low","estimatedPriceEUR":0,"detectedVariant":"...","detectedColor":"...","detectedLeather":"...","detectedHardware":"...","detectedSize":"...","colorAccuracy":75,"alternativeColors":["...","..."],"detectedYear":"...","stampLetter":null,"specialNotes":"...","isSpecialOrder":false,"isExotic":false,"isBiColor":false,"isTriColor":false,"isHSS":false,"secondaryColor":null,"tertiaryColor":null,"condition":"...","analysis":"...","imageSearchQuery":"..."},
  {"rank":4,"brand":"...","model":"...","confidence":60,"confidenceLabel":"Low","estimatedPriceEUR":0,"detectedVariant":"...","detectedColor":"...","detectedLeather":"...","detectedHardware":"...","detectedSize":"...","colorAccuracy":71,"alternativeColors":["...","..."],"detectedYear":"...","stampLetter":null,"specialNotes":"...","isSpecialOrder":false,"isExotic":false,"isBiColor":false,"isTriColor":false,"isHSS":false,"secondaryColor":null,"tertiaryColor":null,"condition":"...","analysis":"...","imageSearchQuery ":"..."}

IMPORTANT: 4 matches always. ]}'''

# PROMPT = '''Extract product attributes from the bag photo. Return ONLY this JSON:
# {"matches":[
#   {"rank":1,"brand":"","model":"","confidence":0,"detectedColor":"","detectedLeather":"","detectedSize":"","condition":"","analysis":""}
# ]}'''


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

    # STEP 1: Detect brand
    brand_key = await detect_brand(photos, photo_mimes)
    logger.info(f"Brand key: {brand_key}")

    # STEP 2: Load knowledge
    base = KNOWLEDGE.get("_base", "")
    brand_knowledge = KNOWLEDGE.get(brand_key, "")
    full_knowledge = base + "\n\n" + brand_knowledge if brand_knowledge else base
    logger.info(
        f"Knowledge loaded: base={bool(base)}, brand={bool(brand_knowledge)}")
    # full_knowledge = "Use your general knowledge about luxury bags."

    # full_knowledge = ""  # only base, no brand knowledge
    logger.info(
        f"Knowledge loaded: base={bool(base)}, brand={bool(brand_knowledge)}")
    logger.info(f"Full knowledge preview: {full_knowledge[:300]}")

    # STEP 3: Build prompt + images
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

    content = [{
        "type": "text",
        "text": f"{PROMPT}\n\nREFERENCE KNOWLEDGE:\n{full_knowledge}"
    }] + image_content

    # content = [{
    #     "type": "text",
    #     "text": "Describe what you see in this image. Return JSON: {\"description\": \"...\"}"
    # }] + image_content

    # STEP 4: Call API
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            json={
                "model": "gpt-4o",
                "max_tokens": 2500,
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a luxury goods cataloguing assistant. Your job is to extract and classify product attributes from bag photos for inventory and valuation purposes. Always return valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": content
                    }
                ]
            }
        )
        response.raise_for_status()
        data = response.json()
        # add this
        logger.info(f"API response: {json.dumps(data, indent=2)[:500]}")

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

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {text[:300]}")
        raise HTTPException(status_code=422, detail=f"Invalid JSON: {str(e)}")

    matches = parsed.get("matches", [])
    if not matches:
        raise HTTPException(status_code=422, detail="No matches in response")

    # add this
    logger.error(f"Raw matches from API: {json.dumps(matches[0], indent=2)}")

    # STEP 6: Validate with Pydantic
    try:
        validated = [BagMatch(**m).model_dump() for m in matches]
    except ValidationError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(
            status_code=422, detail=f"Invalid response format: {str(e)}")

    logger.info(
        f"Done in {time.time() - start_time:.2f}s | brand={brand_key} | photos={len(photos)}")
    return validated
