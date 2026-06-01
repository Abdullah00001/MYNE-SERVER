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
from app.services.serp_service_copy import detect_currency_symbol, extract_price, to_eur

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

    # Physical attributes
    detectedConstruction: Optional[str] = None
    detectedColors: List[str] = Field(default=[])   # ALL colors as list
    detectedLeathers: str = Field(default=[])  # ALL visible leathers as list
    detectedHardware: str = Field(default="Not visible")
    detectedSize: str = Field(default="Not visible")
    colorAccuracy: int = Field(default=0, ge=0, le=100)
    alternativeColors: List[str] = Field(default=[])

    # Identity
    # "Arlequin", "So Black", "Cargo" etc
    editionName: Optional[str] = None
    # free text: HSS, Bicolor, Standard etc
    special_variant: str = Field(default="")

    # Flags
    isSpecialOrder: bool = Field(default=False)
    isExotic: bool = Field(default=False)
    isLimitedEdition: bool = Field(default=False)
    isBiColor: bool = Field(default=False)
    isTriColor: bool = Field(default=False)
    isMultiColor: bool = Field(default=False)      # 4+ colors
    isHSS: bool = Field(default=False)

    # Condition & search
    condition: str = Field(default="Not visible")
    # analysis: str = Field(default="")
    imageSearchQuery: str = Field(default="")

    # Populated after identification
    imageUrl: str = Field(default="")
    thumbnailUrl: str = Field(default="")

    @field_validator('confidence', mode='before')
    @classmethod
    def coerce_confidence(cls, v):
        return int(float(v) * 100) if isinstance(v, float) and v <= 1 else int(v)

    @field_validator('detectedSize', mode='before')
    @classmethod
    def coerce_size(cls, v):
        return str(v)

    @field_validator('detectedColors', mode='before')
    @classmethod
    def coerce_colors(cls, v):
        if isinstance(v, str):
            return [v]  # handle if AI returns string instead of list
        return v

    @field_validator('confidenceLabel')
    @classmethod
    def validate_confidence_label(cls, v: str) -> str:
        if v not in ['High', 'Medium', 'Low']:
            raise ValueError('confidenceLabel must be High, Medium, or Low')
        return v


PROMPT = '''You are an expert luxury handbag cataloguing assistant. Analyze the photo(s) and return ONLY valid JSON with exactly 4 matches ordered by confidence.

IDENTIFICATION RULES:
- Be decisive. Never use "maybe", "possibly". Always commit to the closest match.
- detectedColors: list ALL visible colors using EXACT official brand names. Never generic.
  e.g. never ["blue", "orange"] — always ["Bleu Nuit", "Orange H"]
  For multicolor bags list ALL panels: ["Orange H", "Sanguine", "Bleu Hydra", "Gold", "Etain", "Bleu Lin"]
- detectedLeathers: exact official leather names (Togo, Clemence, Epsom, Caviar, Saffiano etc), more than one in case of several leather bags.
- detectedConstruction:
  "Sellier" = stitching is VISIBLE on the OUTSIDE edge of the bag, sharp corners, rigid structured silhouette
  "Retourne" = NO visible stitching on outer edge, soft/rounded corners, slight slouch
  When uncertain between the two, examine the corner shape — sharp = Sellier, rounded = Retourne (these are only for Hermès, other brands may have different construction but use same terms if similar)
  null only if construction is genuinely not applicable
- detectedSize: integer only. Estimate from proportions if not visible.
- colorAccuracy: 0-100 confidence in color detection
- alternativeColors: list as many colors as relevant from the SAME color family as the main body color (first item in detectedColors). e.g. if "Rouge H" → ["Rouge Casaque", "Rouge Vif", "Vermillon", "Capucine", "Rouge Tomate", "Brique"]. Always populate this, even if confident.
- editionName: named edition if identifiable e.g. "Arlequin", "So Black", "Cargo", "Shadow", "Faubourg"

FLAG RULES:
- isBiColor: true ONLY if exactly 2 distinct color panels visible
- isTriColor: true ONLY if exactly 3 distinct color panels visible  
- isMultiColor: true if 4+ distinct color panels visible (e.g. Arlequin)
- isHSS: true if two-tone leather AND/OR contrasting stitching visible
- isSpecialOrder: true if custom colorway, HSS, or made-to-order
- isLimitedEdition: true if known limited production run (Arlequin, So Black, Faubourg etc)
- isExotic: true if crocodile, ostrich, lizard, python, or other exotic leather

IMAGE SEARCH QUERY RULES:
- Always include: Brand + Model + Size + all detectedColors + Leather + Hardware + Construction + condition if visible
- Add editionName if not empty
- Add special_variant if not Standard
- Add new if condition new
- Multicolor example: "Hermès Birkin Arlequin 35 Orange Sanguine Bleu Hydra Clemence Palladium"
- Exotic example: "Hermès Kelly 28 Sellier Porosus Crocodile Noir Palladium"
- Limited example: "Chanel Classic Flap So Black 25 Lambskin Black Hardware"
- Standard example: "Louis Vuitton Neverfull MM Monogram Canvas Gold"

Return ONLY this JSON shape, no explanation, no markdown:
{"matches":[
  {
    "rank":1,
    "brand":"Hermès",
    "model":"Birkin Arlequin 35",
    "confidence":93,
    "confidenceLabel":"High",
    "estimatedValueEUR":95000,
    "detectedConstruction":"Retourne",
    "detectedColors":["Orange H","Sanguine","Bleu Hydra","Gold","Etain","Bleu Lin"],
    "detectedLeathers": "Clemence, Swift",
    "detectedHardware":"Palladium",
    "detectedSize":"35",
    "colorAccuracy":88,
    "alternativeColors":[],
    "editionName":"Arlequin",
    "special_variant":"Arlequin Limited Edition",
    "isSpecialOrder":true,
    "isExotic":false,
    "isLimitedEdition":true,
    "isBiColor":false,
    "isTriColor":false,
    "isMultiColor":true,
    "isHSS":false,
    "condition":"Excellent",
    "imageSearchQuery":"Hermès Birkin Arlequin 35 Orange Sanguine Bleu Hydra Gold Etain Bleu Lin Clemence & Swift Palladium new"
  },
  {"rank":2,"brand":"...","model":"...","confidence":70,"confidenceLabel":"Medium","estimatedValueEUR":0,"detectedConstruction":null,"detectedColors":["..."],"detectedLeathers":"...","detectedHardware":"...","detectedSize":"...","colorAccuracy":60,"alternativeColors":[],"editionName":null,"special_variant":"","isSpecialOrder":false,"isExotic":false,"isLimitedEdition":false,"isBiColor":false,"isTriColor":false,"isMultiColor":false,"isHSS":false,"condition":"...","imageSearchQuery":"..."},
  {"rank":3,"brand":"...","model":"...","confidence":50,"confidenceLabel":"Low","estimatedValueEUR":0,"detectedConstruction":null,"detectedColors":["..."],"detectedLeathers":"...","detectedHardware":"...","detectedSize":"...","colorAccuracy":50,"alternativeColors":[],"editionName":null,"special_variant":"","isSpecialOrder":false,"isExotic":false,"isLimitedEdition":false,"isBiColor":false,"isTriColor":false,"isMultiColor":false,"isHSS":false,"condition":"...","imageSearchQuery":"..."},
  {"rank":4,"brand":"...","model":"...","confidence":30,"confidenceLabel":"Low","estimatedValueEUR":0,"detectedConstruction":null,"detectedColors":["..."],"detectedLeathers":"...","detectedHardware":"...","detectedSize":"...","colorAccuracy":40,"alternativeColors":[],"editionName":null,"special_variant":"","isSpecialOrder":false,"isExotic":false,"isLimitedEdition":false,"isBiColor":false,"isTriColor":false,"isMultiColor":false,"isHSS":false,"condition":"...","imageSearchQuery":"..."}
]}

IMPORTANT:
- Always return exactly 4 matches
- Rank 1: highest confidence identification
- Rank 2: same family but DIFFERENT size (e.g. if rank1 is 25, try 30)
- Rank 3: different model entirely within same brand (e.g. Kelly instead of Birkin)
- Rank 4: different brand OR most different plausible interpretation (e.g. simple Birkin)
- Never repeat same brand+model twice
- Never leave imageSearchQuery empty'''


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
        if i == 0 and lens_data["prices"]:
            raw = lens_data["prices"][0]  # e.g. "$25,000*"
            price = extract_price(raw)
            if price:
                symbol = detect_currency_symbol(raw)
                eur = to_eur(price, symbol)
                match["estimatedValueEUR"] = int(eur)
                logger.info(
                    f"[lens_price] raw={raw} | symbol={symbol} | price={price} | eur={eur}")
    logger.info(
        f"Done in {time.time() - start_time:.2f}s | brand={brand_key} | photos={len(photos)}")
    return validated
