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
from app.services.price_service import to_eur, detect_currency_symbol, extract_price

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
    # confidenceLabel: str = Field(default="Low", pattern="^(High|Medium|Low)$")
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

    # @field_validator('confidenceLabel')
    # @classmethod
    # def validate_confidence_label(cls, v: str) -> str:
    #     if v not in ['High', 'Medium', 'Low']:
    #         raise ValueError('confidenceLabel must be High, Medium, or Low')
    #     return v


PROMPT = '''

Before outputting JSON, silently reason through these steps:
1. What are ALL visible physical features? (shape, hardware, stitching, size, colors, leather texture)
2. What is the single most likely identification? Commit to it.
3. What are 3 genuinely different alternative interpretations of the SAME image?
   - Each must differ in at least 2 of: brand, model, size, colorway
   - Ask yourself: "If rank 1 is wrong, what else could this realistically be?"
4. Only then output the JSON.


You are an expert luxury handbag cataloguing assistant. Analyze the photo(s) and return ONLY valid JSON with exactly 4 matches ordered by confidence.

IDENTIFICATION RULES:
- Be decisive. Never use "maybe", "possibly". Always commit to the closest match.
- PRIORITY: The most critical aspect is the exact color. If the color is slightly off, the valuation is worthless. Use the EXACT official brand color name with 100% precision. NEVER use generic colors.
  e.g. never ["blue", "orange"] — always ["Bleu Nuit", "Orange H"]
  For multicolor bags list ALL panels: ["Orange H", "Sanguine", "Bleu Hydra", "Gold", "Etain", "Bleu Lin"]
- SPECIAL EDITIONS: Explicitly identify if the bag is a "Limited Edition", "Special Edition", "Runway", or a Collaboration (e.g., "Yayoi Kusama", "Supreme", "Murakami"). If it is a special edition, it must be explicitly noted in the model or subtitle.
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
    "estimatedValueEUR":95000,
    "detectedConstruction":"Retourne",
    "detectedColors":["Orange H","Sanguine","Bleu Hydra","Gold","Etain","Bleu Lin"],
    "detectedLeathers":"Clemence, Swift",
    "detectedHardware":"Palladium",
    "detectedSize":"35",
    "colorAccuracy":88,
    "alternativeColors":["Brique","Capucine","Rouge H","Vermillon"],
    "editionName":"Arlequin",
    "special_variant":"Arlequin Limited Edition",
    "isSpecialOrder":false,
    "isExotic":false,
    "isLimitedEdition":true,
    "isBiColor":false,
    "isTriColor":false,
    "isMultiColor":true,
    "isHSS":false,
    "condition":"Excellent",
    "imageSearchQuery":"Hermès Birkin Arlequin 35 Orange H Sanguine Bleu Hydra Gold Etain Bleu Lin Clemence Swift Palladium"
  },
  {
    "rank":2,
    "brand":"Hermès",
    "model":"Birkin Arlequin 30",
    "confidence":72,
    "estimatedValueEUR":85000,
    "detectedConstruction":"Retourne",
    "detectedColors":["Sanguine","Bleu Hydra","Etain","Orange H"],
    "detectedLeathers":"Togo, Clemence",
    "detectedHardware":"Gold",
    "detectedSize":"30",
    "colorAccuracy":75,
    "alternativeColors":["Rouge H","Rouge Casaque","Vermillon","Capucine"],
    "editionName":"Arlequin",
    "special_variant":"Arlequin Limited Edition",
    "isSpecialOrder":false,
    "isExotic":false,
    "isLimitedEdition":true,
    "isBiColor":false,
    "isTriColor":false,
    "isMultiColor":true,
    "isHSS":false,
    "condition":"Very Good",
    "imageSearchQuery":"Hermès Birkin Arlequin 30 Sanguine Bleu Hydra Etain Orange H Togo Clemence Gold"
  },
  {
    "rank":3,
    "brand":"Hermès",
    "model":"Kelly 32 Retourne",
    "confidence":48,
    "estimatedValueEUR":22000,
    "detectedConstruction":"Retourne",
    "detectedColors":["Bleu Saphir"],
    "detectedLeathers":"Togo",
    "detectedHardware":"Palladium",
    "detectedSize":"32",
    "colorAccuracy":65,
    "alternativeColors":["Bleu Nuit","Bleu Indigo","Bleu de Prusse","Bleu Encre","Bleu Abysse"],
    "editionName":null,
    "special_variant":"",
    "isSpecialOrder":false,
    "isExotic":false,
    "isLimitedEdition":false,
    "isBiColor":false,
    "isTriColor":false,
    "isMultiColor":false,
    "isHSS":false,
    "condition":"Good",
    "imageSearchQuery":"Hermès Kelly 32 Retourne Bleu Saphir Togo Palladium"
  },
  {
    "rank":4,
    "brand":"Louis Vuitton",
    "model":"Speedy Bandoulière 30",
    "confidence":28,
    "estimatedValueEUR":1400,
    "detectedConstruction":null,
    "detectedColors":["Monogram Canvas","Vachetta"],
    "detectedLeathers":"Monogram Canvas, Vachetta Leather",
    "detectedHardware":"Gold",
    "detectedSize":"30",
    "colorAccuracy":55,
    "alternativeColors":["Damier Ebene","Damier Azur"],
    "editionName":null,
    "special_variant":"",
    "isSpecialOrder":false,
    "isExotic":false,
    "isLimitedEdition":false,
    "isBiColor":false,
    "isTriColor":false,
    "isMultiColor":false,
    "isHSS":false,
    "condition":"Good",
    "imageSearchQuery":"Louis Vuitton Speedy Bandoulière 30 Monogram Canvas Vachetta Gold"
  }
]}

IMPORTANT:
- Always return exactly 4 matches
RANK RULES:
- Rank 1: Your highest confidence identification based on all visible evidence. Fully commit.
- Rank 2: Ask "what if the size or material is wrong?" 
  Must be the EXACT same brand and model as Rank 1, but differ in size, colorway, or material.
- Rank 3: Ask "what if this is a closely related variant?" 
  Must be the EXACT same brand, but a visually similar alternative model or shape. NEVER pick a completely different style (e.g. no backpacks for totes).
- Rank 4: Ask "what if it is a different era or collection?" 
  Must be the EXACT same brand, but perhaps an older vintage version or a different material of a similar silhouette.
- HARD RULE: Never suggest a different brand. Never show irrelevant models. Read each rank's JSON back against rank 1 before finalizing.
- Never leave imageSearchQuery empty'''


async def get_lens_data(url: str) -> Dict[str, Any]:
    """Use SerpAPI Google Lens with a direct image URL"""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            "https://serpapi.com/search",
            params={
                "engine": "google_lens",
                "url": url,
                "api_key": SERP_API_KEY,
            }
        )
        response.raise_for_status()
        data = response.json()

    visual_matches = data.get("visual_matches", [])
    titles = [m.get("title", "") for m in visual_matches[:5] if m.get("title")]
    # image_urls = [m.get("thumbnail", "")
    #               for m in visual_matches[:4] if m.get("thumbnail")]

    image_urls = [
        m.get("original") or m.get("thumbnail", "")
        for m in visual_matches[:4]
        if m.get("original") or m.get("thumbnail")
    ]

    prices = [m.get("price", {}).get("value", "") for m in visual_matches[:4]]

    logger.info(f"Lens titles: {titles}")
    logger.info(f"Lens image URLs: {len(image_urls)}")
    logger.info(f"Lens prices: {prices}")

    return {
        "titles": titles,
        "image_urls": image_urls,
        "prices": prices,
    }


async def detect_brand(url: str) -> str:
    image_content = [
        {
            "type": "image_url",
            "image_url": {
                "url": url,
                "detail": "low"
            }
        }
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
                "model": "gpt-4o-mini",
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


async def identify_bag(url: str) -> List[Dict[str, Any]]:
    t0 = time.time()

    if not url:
        raise HTTPException(status_code=400, detail="No URL provided")

    # STEP 1: Get Lens data
    lens_data = await get_lens_data(url)
    image_urls = lens_data["image_urls"]
    t1 = time.time()
    logger.info(f"[T] lens={t1-t0:.2f}s")

    logger.info(f"Full lens data: {json.dumps(lens_data, indent=2)}")

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

    if brand_key == "unknown":
        brand_key = await detect_brand(url)
        logger.info(f"Brand from detect_brand fallback: {brand_key}")

    t2 = time.time()
    logger.info(f"[T] brand={t2-t1:.2f}s")

    base = KNOWLEDGE.get("_base", "")
    brand_knowledge = KNOWLEDGE.get(brand_key, "")
    full_knowledge = base + "\n\n" + brand_knowledge if brand_knowledge else base

    image_content = [
        {
            "type": "image_url",
            "image_url": {
                "url": url,
                "detail": "high"
            }
        }
    ]

    # STEP 3: Build prompt + images
    content = [{
        "type": "text",
        "text": "I'm cataloguing this pre-owned luxury handbag for resale inventory. "
        "Please identify the brand, model, and attributes.\n\n"
        + PROMPT + "\n\nREFERENCE KNOWLEDGE:\n" + full_knowledge + "\n\n" + hints
    }] + image_content

    # STEP 4: Call API
    data = None
    async with httpx.AsyncClient(timeout=90) as client:
        for model in ["gpt-4o-2024-11-20", "gpt-4o-mini"]:
            json_body = {
                "model": model,
                "max_tokens": 1800,
                "temperature": 0.3,
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

    t3 = time.time()
    logger.info(f"[T] gpt4o={t3-t2:.2f}s")

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

    matches = parsed.get("matches", [])
    if not matches:
        raise HTTPException(status_code=422, detail="No matches in response")

    logger.info(f"Raw matches from API: {json.dumps(matches[0], indent=2)}")

    # STEP 6: Validate with Pydantic
    try:
        validated = [BagMatch(**m).model_dump() for m in matches]
    except ValidationError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(
            status_code=422, detail=f"Invalid response format: {str(e)}")

    t4 = time.time()
    logger.info(f"[T] parse={t4-t3:.2f}s")

    # STEP 7: Attach image URLs from Lens + pricing
    PRIORITY_IMAGE_DOMAINS = [
        "vestiairecollective", "therealreal", "fashionphile",
        "madisonavenuecouture", "1stdibs", "sothebys", "rebag"
    ]

    def pick_best_image(urls: list) -> str:
        # skip encrypted/expiring Google proxy URLs
        clean = [u for u in urls if "encrypted-tbn" not in u]
        urls_to_use = clean if clean else urls
        for domain in PRIORITY_IMAGE_DOMAINS:
            for u in urls_to_use:
                if domain in u:
                    return u
        return urls_to_use[0] if urls_to_use else ""

    for i, match in enumerate(validated):
        if i == 0:
            match["imageUrl"] = pick_best_image(
                image_urls) if image_urls else ""
            match["thumbnailUrl"] = match["imageUrl"]
            if lens_data["prices"]:
                valid_eurs = []
                for raw in lens_data["prices"]:
                    if not raw: continue
                    price = extract_price(raw)
                    if price:
                        symbol = detect_currency_symbol(raw)
                        eur = to_eur(price, symbol)
                        if eur > 100:  # basic sanity check
                            valid_eurs.append(eur)
                
                if valid_eurs:
                    valid_eurs.sort()
                    # Trim extreme outliers if we have enough data points
                    if len(valid_eurs) > 3:
                        valid_eurs = valid_eurs[1:-1]
                    # Calculate median
                    median_eur = valid_eurs[len(valid_eurs) // 2]
                    match["estimatedValueEUR"] = int(median_eur)
                    logger.info(f"[lens_price] valid_eurs={valid_eurs} | median_eur={median_eur}")
        else:
            match["imageUrl"] = ""
            match["thumbnailUrl"] = ""

    # FINAL summary line
    logger.info(
        f"[T] TOTAL={t4-t0:.2f}s | lens={t1-t0:.2f} brand={t2-t1:.2f} gpt={t3-t2:.2f} parse={t4-t3:.2f} | brand_key={brand_key}")
    return validated