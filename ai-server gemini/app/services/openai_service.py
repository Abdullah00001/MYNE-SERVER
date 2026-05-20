from google import genai
import json
import logging
import os
import time
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from pydantic import BaseModel, Field, ValidationError, field_validator
from app.config import GEMINI_API_KEY
from google.genai import types
import base64

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
BASE_DIR = os.path.dirname(__file__)
MAX_IMAGES = 10
MAX_IMAGE_SIZE_MB = 5

# Configure Gemini
client = genai.Client(api_key=GEMINI_API_KEY)
# model = genai.GenerativeModel("gemini-2.0-flash")

PROMPT = '''You are a world class luxury bag authentication and cataloguing specialist with 20 years of experience.

Analyze the bag photo(s) and return ONLY valid JSON with exactly 4 matches ordered by confidence.

RULES:
- Be decisive. Never use "maybe", "possibly". If uncertain, pick closest match.
- detectedColor: EXACT official brand color name only. Never generic (e.g. never "blue", always "Bleu Nuit").
- If lighting affects color, still commit to closest single color.
- detectedLeather: use exact official leather name (e.g. Togo, Clemence, Epsom, Caviar, Saffiano).
- detectedVariant: "Sellier"=rigid/outside stitch, "Retourne"=soft/inside stitch, "Pochette"=clutch. Null if not applicable.
- detectedSize: always output integer. Estimate from proportions if not visible.
- stampLetter: Hermès only, null for all other brands.
- colorAccuracy: 0-100 integer.
- alternativeColors: 2-3 alternatives if ambiguous, [] if certain.
- secondaryColor: null unless isBiColor or isHSS is true.
- tertiaryColor: null unless isTriColor is true.
- isBiColor: true only if two distinct color panels clearly visible.
- isTriColor: true only if three distinct color panels clearly visible.
- isHSS: true only if BOTH two-tone leather AND contrasting stitching visible.
- Never use "/" in detectedColor, use secondaryColor field instead.
- "Not visible" for any feature that cannot be determined.
- estimatedValueEUR: 2025 EU resale market price. Special Order +30-200%. Exotic leather +300-1000%.
- imageSearchQuery format:
  Standard: "{Brand} {Model} {Size} {Variant} {Color} {Leather} {Hardware}"
  Bi-color: "{Brand} {Model} {Size} bicolor {PrimaryColor} {SecondaryColor}"
  HSS: "{Brand} {Model} {Size} HSS special order"
  Exotic: "{Brand} {Model} {Size} {ExoticLeather} {Color}"

Return ONLY this JSON shape, no explanation, no markdown:
{"matches":[
  {"rank":1,"brand":"","model":"","confidence":0,"confidenceLabel":"High","estimatedValueEUR":0,"detectedVariant":null,"detectedColor":"","detectedLeather":"","detectedHardware":"","detectedSize":"","colorAccuracy":0,"alternativeColors":[],"detectedYear":null,"stampLetter":null,"specialNotes":"","isSpecialOrder":false,"isExotic":false,"isBiColor":false,"isTriColor":false,"isHSS":false,"secondaryColor":null,"tertiaryColor":null,"condition":"","analysis":"","imageSearchQuery":""},
  {"rank":2,...},
  {"rank":3,...},
  {"rank":4,...}
]}'''


# Pydantic model - unchanged
class BagMatch(BaseModel):
    rank: int = Field(..., ge=1, le=4)
    brand: str
    model: str
    confidence: int = Field(..., ge=0, le=100)
    confidenceLabel: str = Field(..., pattern="^(High|Medium|Low)$")
    estimatedValueEUR: int = Field(..., ge=0)
    detectedVariant: Optional[str] = None
    detectedColor: str
    detectedLeather: str
    detectedHardware: str
    detectedSize: str
    colorAccuracy: int = Field(..., ge=0, le=100)
    alternativeColors: List[str] = []
    detectedYear: Optional[str] = None
    stampLetter: Optional[str] = None
    specialNotes: str
    isSpecialOrder: bool
    isExotic: bool
    isBiColor: bool
    isTriColor: bool
    isHSS: bool
    secondaryColor: Optional[str] = None
    tertiaryColor: Optional[str] = None
    condition: str
    analysis: str
    imageSearchQuery: str

    @field_validator('confidenceLabel')
    @classmethod
    def validate_confidence_label(cls, v: str) -> str:
        if v not in ['High', 'Medium', 'Low']:
            raise ValueError('confidenceLabel must be High, Medium, or Low')
        return v


def validate_image_size(b64_string: str) -> bool:
    size_bytes = len(b64_string) * 3 // 4
    size_mb = size_bytes / (1024 * 1024)
    if size_mb > MAX_IMAGE_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"Image exceeds {MAX_IMAGE_SIZE_MB}MB limit (actual: {size_mb:.2f}MB)"
        )
    return True


def validate_inputs(photos: List[str], photo_mimes: List[str]):
    if not photos or not photo_mimes:
        raise HTTPException(status_code=400, detail="No photos provided")

    if len(photos) != len(photo_mimes):
        raise HTTPException(
            status_code=400, detail="Photos count doesn't match mimes count")

    if len(photos) > MAX_IMAGES:
        raise HTTPException(
            status_code=400, detail=f"Maximum {MAX_IMAGES} photos allowed")

    for b64 in photos:
        validate_image_size(b64)

    valid_mimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
    for mime in photo_mimes:
        if mime not in valid_mimes:
            raise HTTPException(
                status_code=400, detail=f"Invalid mime type: {mime}")

    return True


def prepare_images(photos: List[str], photo_mimes: List[str]) -> List:
    """Convert base64 images to Gemini new SDK format"""
    return [
        types.Part.from_bytes(
            data=base64.b64decode(b64),
            mime_type=mime
        )
        for b64, mime in zip(photos, photo_mimes)
    ]


# async def detect_brand(photos: List[str], photo_mimes: List[str]) -> str:
#     """Detect brand from images using Gemini"""
#     try:
#         images = prepare_images(photos, photo_mimes)

#         parts = [
#             "What luxury brand is this bag? Return ONLY ONE brand name from this list, nothing else:\n"
#             "Hermès, Chanel, Louis Vuitton, Dior, Gucci, Prada, Bottega Veneta, "
#             "Saint Laurent, Celine, Loewe, Fendi, Valentino, Balenciaga, Givenchy, Burberry."
#         ] + images

#         response = model.generate_content(parts)
#         brand = response.text.strip().split("\n")[0].strip()

#         logger.info(f"Brand detected: {brand}")
#         return brand.lower()

#     except Exception as e:
#         logger.error(f"Brand detection failed: {e}")
#         return "unknown"


async def identify_bag(photos: List[str], photo_mimes: List[str]) -> List[Dict[str, Any]]:
    start_time = time.time()

    try:
        # Step 1: Validate inputs
        validate_inputs(photos, photo_mimes)

        # Step 2: Prepare images for Gemini
        images = prepare_images(photos, photo_mimes)

        # Step 3: Build prompt + images together
        parts = [PROMPT] + images

        # Step 4: Call Gemini with retries
        max_retries = 3
        response = None

        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=[PROMPT] + images,
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                        max_output_tokens=3000,
                        response_mime_type="application/json"
                    )
                )

            except Exception as e:
                wait_time = 5 * (attempt + 1)
                logger.warning(
                    f"Attempt {attempt + 1} failed: {e}, retrying in {wait_time}s")
                time.sleep(wait_time)
                if attempt == max_retries - 1:
                    raise HTTPException(
                        status_code=503, detail=f"Gemini unavailable: {str(e)}")

        # Step 5: Parse response
        text = response.text.strip()

        if not text:
            raise HTTPException(
                status_code=422, detail="Empty response from Gemini")

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON: {text[:500]}")
            raise HTTPException(
                status_code=422, detail=f"Invalid JSON response: {str(e)}")

        matches = parsed.get("matches", [])

        if not matches:
            raise HTTPException(
                status_code=422, detail="No matches found in response")

        # Step 6: Validate with Pydantic
        try:
            validated_matches = []
            for match in matches:
                validated_match = BagMatch(**match)
                validated_matches.append(validated_match.model_dump())
        except ValidationError as e:
            logger.error(f"Validation failed: {e}")
            raise HTTPException(
                status_code=422, detail=f"Invalid response format: {str(e)}")

        duration = time.time() - start_time
        logger.info(f"Completed in {duration:.2f}s for {len(photos)} photos")

        return validated_matches

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
        raise HTTPException(
            status_code=500, detail=f"Internal server error: {str(e)}")
