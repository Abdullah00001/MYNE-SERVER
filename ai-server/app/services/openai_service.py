import httpx
import json
from fastapi import HTTPException
from app.config import OPENAI_API_KEY

PROMPT = '''You are a world-class luxury bag authenticator with 20+ years experience across all major luxury houses. Analyze the photo(s) carefully and return ONLY valid JSON.

IDENTIFICATION RULES:

HERMÈS:
- Exact color names: "Étoupe", "Gris Perle", "Vert Jade", "Rose Sakura", "Bleu Électrique" etc.
- Exact leathers: "Togo", "Epsom", "Swift", "Clemence", "Box Calf", "Barenia", "Chèvre Mysore", "Niloticus Crocodile", "Ostrich", "Lizard"
- Exact models: "Birkin 25/30/35/40", "Mini Kelly II 20", "Kelly 25/28/32 Sellier or Retourne", "Kelly Pochette", "Constance 18/24", "Lindy 26/30", "Picotin 18/22", "Evelyne", "Halzan", "Jypsiere"
- Detect: HSS, Bi-color, Tri-color, Verso, Special Order, stamp letter

CHANEL:
- Exact models: "Classic Flap Small/Medium/Jumbo/Maxi", "Mini Rectangular", "Mini Square", "Boy Small/Medium/Large", "2.55 Reissue", "22 Bag", "19 Bag", "Coco Handle", "Gabrielle", "WOC"
- Exact leathers: "Caviar", "Lambskin", "Goatskin", "Tweed", "Jersey", "Velvet"
- Hardware: "Gold", "Silver", "Ruthenium", "Mixed"
- Serial number format if visible

LOUIS VUITTON:
- Exact lines: "Monogram", "Damier Ebene", "Damier Azur", "Epi", "Mahina", "Empreinte", "Taurillon"
- Exact models: "Neverfull MM/GM/PM", "Speedy 25/30/35", "Alma BB/PM/MM", "Pochette Métis", "OnTheGo MM/GM", "Capucines BB/PM/MM", "Twist MM/PM", "Loop", "Multi Pochette"
- Date code format if visible

DIOR:
- Exact models: "Lady Dior Small/Medium/Large", "Dior Book Tote", "30 Montaigne", "Saddle Bag", "Bobby", "Caro", "Diorama", "Micro Cannage"
- Exact leathers: "Cannage", "Ultramatte", "Smooth Calfskin", "Embroidered"

BOTTEGA VENETA:
- Exact models: "Jodie Mini/Small/Medium", "Arco 33/48", "Cassette", "Pouch", "Andiamo", "Sardine"
- Detect weave size: "Intrecciato standard", "Maxi Intrecciato"

PRADA:
- Exact models: "Re-Edition 2000/2005", "Galleria Small/Medium/Large", "Cleo", "Padded Nappa", "Tessuto Nylon"
- Exact materials: "Saffiano", "Nappa", "Tessuto", "Re-Nylon"

SAINT LAURENT:
- Exact models: "Loulou Small/Medium", "Kate", "Icare", "Solferino", "Envelope", "Le 5 à 7"
- Exact leathers: "Smooth Leather", "Grained Leather", "Suede", "Patent"

CELINE:
- Exact models: "Luggage Nano/Mini/Micro", "Classic Box", "Triomphe", "Teen Triomphe", "Cabas", "AVA"

GUCCI:
- Exact models: "Dionysus Small/Medium", "Marmont Small/Medium/Large", "Bamboo 1947", "Jackie 1961", "Horsebit 1955", "Ophidia"

FOR ALL BRANDS:
- Detect hardware precisely: "Gold", "Silver", "Palladium", "Ruthenium", "Antique Gold", "Rose Gold"
- Detect condition: "Pristine/Box Fresh", "Excellent", "Very Good", "Good", "Fair", "Poor"
- Detect if box fresh/unworn

Return ONLY valid JSON in this exact shape:
{"matches":[
  {
    "rank": 1,
    "brand": "Hermès",
    "model": "Mini Kelly II 20",
    "confidence": 93,
    "confidenceLabel": "High",
    "estimatedValueEUR": 28000,
    "detectedColor": "Étoupe",
    "detectedLeather": "Epsom",
    "detectedHardware": "Palladium",
    "detectedSize": "20 cm",
    "detectedYear": "2022-2023",
    "stampLetter": "Z",
    "specialNotes": "Standard",
    "isSpecialOrder": false,
    "isExotic": false,
    "isBoxFresh": true,
    "comesWith": ["Dustbag", "Box", "Clochette", "Lock", "Keys", "Rain cover", "Receipt"],
    "condition": "Pristine/Box Fresh",
    "conditionDetails": "Unworn, all original accessories present, corners pristine, hardware unmarked",
    "bagDetails": {
      "stitching": "Clean white saddle stitching, evenly spaced",
      "hardware": "Unmarked palladium, no scratches",
      "corners": "Sharp, no wear",
      "interior": "Clean, no marks or odour",
      "authenticity_markers": "Blind stamp visible, Hermès Paris Made in France embossed correctly"
    },
    "analysis": "Detailed expert description.",
    "imageSearchQuery": "Hermès Mini Kelly II 20 Étoupe Epsom Palladium resale 2025"
  },
  {"rank":2,"brand":"...","model":"...","confidence":85,"confidenceLabel":"Medium","estimatedValueEUR":25000,"detectedColor":"...","detectedLeather":"...","detectedHardware":"...","detectedSize":"...","detectedYear":"...","stampLetter":"...","specialNotes":"...","isSpecialOrder":false,"isExotic":false,"isBoxFresh":false,"comesWith":[],"condition":"Very Good","conditionDetails":"...","bagDetails":{"stitching":"...","hardware":"...","corners":"...","interior":"...","authenticity_markers":"..."},"analysis":"...","imageSearchQuery":"..."},
  {"rank":3,"brand":"...","model":"...","confidence":70,"confidenceLabel":"Low","estimatedValueEUR":20000,"detectedColor":"...","detectedLeather":"...","detectedHardware":"...","detectedSize":"...","detectedYear":"...","stampLetter":"...","specialNotes":"...","isSpecialOrder":false,"isExotic":false,"isBoxFresh":false,"comesWith":[],"condition":"Good","conditionDetails":"...","bagDetails":{"stitching":"...","hardware":"...","corners":"...","interior":"...","authenticity_markers":"..."},"analysis":"...","imageSearchQuery":"..."},
  {"rank":4,"brand":"...","model":"...","confidence":60,"confidenceLabel":"Low","estimatedValueEUR":15000,"detectedColor":"...","detectedLeather":"...","detectedHardware":"...","detectedSize":"...","detectedYear":"...","stampLetter":"...","specialNotes":"...","isSpecialOrder":false,"isExotic":false,"isBoxFresh":false,"comesWith":[],"condition":"Good","conditionDetails":"...","bagDetails":{"stitching":"...","hardware":"...","corners":"...","interior":"...","authenticity_markers":"..."},"analysis":"...","imageSearchQuery":"..."}
]}

IMPORTANT:
- Always return exactly 4 matches ranked by confidence
- estimatedValueEUR must reflect current 2025 European resale market prices
- For Hermès Special Orders add +30-200% to base value
- For exotic leathers add +300-1000% to base value
- stampLetter only applies to Hermès, use null for other brands
- Return ONLY the JSON object, no extra text'''


async def identify_bag(photos: list, photo_mimes: list):
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
    image_content.append({"type": "text", "text": PROMPT})

    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-4o",
                "max_tokens": 3000,
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an expert luxury handbag appraiser helping collectors identify and value their authentic bags for insurance and resale purposes."
                    },
                    {
                        "role": "user",
                        "content": image_content
                    }
                ]
            }
        )
        res.raise_for_status()
        data = res.json()

        choice = data["choices"][0]

        # ← ADD THIS: check finish_reason
        if choice.get("finish_reason") == "length":
            raise HTTPException(
                status_code=422, detail="OpenAI response cut off — reduce max_tokens or image size")

        text = choice["message"]["content"]
        if not text:
            raise HTTPException(
                status_code=422, detail=f"OpenAI returned empty content. Reason: {choice.get('finish_reason')}")

        text = text.strip()
        parsed = json.loads(text)
        return parsed.get("matches", [])
