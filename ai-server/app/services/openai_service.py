import httpx
import json
from fastapi import HTTPException
from app.config import OPENAI_API_KEY

import os

BASE_DIR = os.path.dirname(__file__)
with open(os.path.join(BASE_DIR, "knowledge.txt"), "r", encoding="utf-8") as f:
    KNOWLEDGE_BASE = f.read()

# PROMPT = '''You are a luxury goods cataloguing specialist. Analyze the bag photo(s) and extract product attributes for inventory classification. Return ONLY valid JSON..

# IDENTIFICATION RULES:

# HERMÈS:
# - Exact color names and be specific about colors
# - detectedColor: pick the SINGLE most likely Hermès color name. Do NOT output generic colors (e.g., "blue", "brown"). Use precise names (e.g., "Bleu Nuit", "Gold", "Etoupe"). If uncertain between similar shades, choose the closest match. Never use "/" or multiple colors unless it is clearly a confirmed bi-color or HSS bag.
# - If lighting or image quality affects color perception, still output the closest single color instead of saying "uncertain".

# - Exact leathers: strictly choose ONLY from this list:
#   "Togo", "Epsom", "Swift", "Clemence", "Box Calf", "Barenia", "Chèvre Mysore", "Niloticus Crocodile", "Ostrich", "Lizard"
# - If texture is unclear, choose the most likely based on visible grain and structure. Do NOT invent new leather names.

# - Exact models: strictly choose ONLY from this list:
#   "Birkin", "Mini Kelly II", "Kelly", "Kelly Pochette", "Constance", "Lindy", "Picotin", "Evelyne", "Halzan", "Jypsiere" etc
# - Select the closest matching size if exact size is uncertain.

# - Exact Variant: strictly choose from:
#   "Sellier", "Retourne", "Pochette"
# - Base this on structure (rigid vs soft).

# - Exact Size:
# - Always output a size. If not clearly visible, estimate based on proportions and typical dimensions. for example: "18", "20", "22", "25", "27", "30", "31", "35", "40", "46"

# - Detect:
#   - HSS (Horseshoe Stamp): two-tone leather with contrasting stitching (Horseshoe Stamp Special Order)
#   - Bi-color / Tri-color ; two/three distinct colors
#   - Verso : outside are different colors (interior visible at flap)
#   - Special Order
#   - Stamp letter (if visible)

# - If a feature is not visible, return "Not visible" instead of guessing.

# - Be decisive. Avoid vague terms like "maybe", "possibly", "looks like".
# - Output must be consistent, structured, and use only allowed values.

# CHANEL:
# - Exact models: "Classic Flap Small/Medium/Jumbo/Maxi", "Mini Rectangular", "Mini Square", "Boy Small/Medium/Large", "2.55 Reissue", "22 Bag", "19 Bag", "Coco Handle", "Gabrielle", "WOC"
# - Exact leathers: "Caviar", "Lambskin", "Goatskin", "Tweed", "Jersey", "Velvet"
# - Hardware: "Gold", "Silver", "Ruthenium", "Mixed"
# - Serial number format if visible

# LOUIS VUITTON:
# - Exact lines: "Monogram", "Damier Ebene", "Damier Azur", "Epi", "Mahina", "Empreinte", "Taurillon"
# - Exact models: "Neverfull MM/GM/PM", "Speedy 25/30/35", "Alma BB/PM/MM", "Pochette Métis", "OnTheGo MM/GM", "Capucines BB/PM/MM", "Twist MM/PM", "Loop", "Multi Pochette"
# - Date code format if visible

# DIOR:
# - Exact models: "Lady Dior Small/Medium/Large", "Dior Book Tote", "30 Montaigne", "Saddle Bag", "Bobby", "Caro", "Diorama", "Micro Cannage"
# - Exact leathers: "Cannage", "Ultramatte", "Smooth Calfskin", "Embroidered"

# BOTTEGA VENETA:
# - Exact models: "Jodie Mini/Small/Medium", "Arco 33/48", "Cassette", "Pouch", "Andiamo", "Sardine"
# - Detect weave size: "Intrecciato standard", "Maxi Intrecciato"

# PRADA:
# - Exact models: "Re-Edition 2000/2005", "Galleria Small/Medium/Large", "Cleo", "Padded Nappa", "Tessuto Nylon"
# - Exact materials: "Saffiano", "Nappa", "Tessuto", "Re-Nylon"

# SAINT LAURENT:
# - Exact models: "Loulou Small/Medium", "Kate", "Icare", "Solferino", "Envelope", "Le 5 à 7"
# - Exact leathers: "Smooth Leather", "Grained Leather", "Suede", "Patent"

# CELINE:
# - Exact models: "Luggage Nano/Mini/Micro", "Classic Box", "Triomphe", "Teen Triomphe", "Cabas", "AVA"

# GUCCI:
# - Exact models: "Dionysus Small/Medium", "Marmont Small/Medium/Large", "Bamboo 1947", "Jackie 1961", "Horsebit 1955", "Ophidia"

# FOR ALL BRANDS:
# - Detect hardware precisely: "Gold", "Silver", "Palladium", "Ruthenium", "Antique Gold", "Rose Gold"
# - Detect condition: "New", "Excellent", "Very Good", "Good", "Fair"
# - Detect if box fresh/unworn
# - colorAccuracy: integer 0-100 representing confidence in the detected color
# - alternativeColors: list of 2-3 other possible color names if color is ambiguous. Empty array [] if color is certain.


# Return ONLY valid JSON in this exact shape:
# {"matches":[
#   {
#     "rank": 1,
#     "brand": "Hermès",
#     "model": "Mini Kelly II",
#     "confidence": 93,
#     "confidenceLabel": "High",
#     "estimatedValueEUR": 28000,
#     "detectedVariant": "Sellier",
#     "detectedColor": "Étoupe",
#     "detectedLeather": "Epsom",
#     "detectedHardware": "Palladium",
#     "detectedSize": "20 cm",
#     "colorAccuracy": 87,
#     "alternativeColors": ["Bleu Nuit", "Bleu Indigo", "Marine"],
#     "detectedYear": "2022-2023",
#     "stampLetter": "Z",
#     "specialNotes": "Standard",
#     "isSpecialOrder": false,
#     "isExotic": false,
#     "condition": "New",
#     "analysis": "Detailed expert description.",
#     "imageSearchQuery": "Hermès Mini Kelly II 20 Sellier Étoupe Epsom Palladium resale 2025"
#   },
#   {"rank":2,"brand":"...","model":"...","confidence":85,"confidenceLabel":"Medium","estimatedValueEUR":25000,"detectedVariant":"...","detectedColor":"...","detectedLeather":"...","detectedHardware":"...","detectedSize":"...","colorAccuracy":78,"alternativeColors": ["...", "..."] ,"detectedYear":"...","stampLetter":"...","specialNotes":"...","isSpecialOrder":false,"isExotic":false,"condition":"Very Good","analysis":"...","imageSearchQuery":"..."},
#   {"rank":3,"brand":"...","model":"...","confidence":70,"confidenceLabel":"Low","estimatedValueEUR":20000,"detectedVariant":"...","detectedColor":"...","detectedLeather":"...","detectedHardware":"...","detectedSize":"...","colorAccuracy": 75,"alternativeColors": ["...", "..."] ,"detectedYear":"...","stampLetter":"...","specialNotes":"...","isSpecialOrder":false,"isExotic":false,"condition":"Good","analysis":"...","imageSearchQuery":"..."},
#   {"rank":4,"brand":"...","model":"...","confidence":60,"confidenceLabel":"Low","estimatedValueEUR":15000,"detectedVariant":"...","detectedColor":"...","detectedLeather":"...","detectedHardware":"...","detectedSize":"...","colorAccuracy": 71,"alternativeColors": ["...", "..."] ,"detectedYear":"...","stampLetter":"...","specialNotes":"...","isSpecialOrder":false,"isExotic":false,"condition":"Good","analysis":"...","imageSearchQuery":"..."}
# ]}

# IMPORTANT:
# - Always return exactly 4 matches ranked by confidence
# - estimatedValueEUR must reflect current 2025 European resale market prices
# - For Hermès Special Orders add +30-200% to base value
# - For exotic leathers add +300-1000% to base value
# - detectedColor: Identify the EXACT official colorway name used by the brand.
#   Do not invent or approximate color names.
#   For Hermès: use official Hermès color names (e.g. "Vert Criquet", "Étoupe", "Bleu Électrique")
#   For Chanel: use official Chanel color names (e.g. "Black", "Beige Clair", "Navy")
#   For Louis Vuitton: use the line name (e.g. "Monogram", "Damier Ebene")
#   Base color identification on: leather tone, saturation, undertones, and comparison to known colorways.
#   If genuinely uncertain between two similar colors, pick the most likely one and note uncertainty in analysis field.
# - stampLetter only applies to Hermès, use null for other brands
# - Return ONLY the JSON object, no extra text'''

PROMPT = '''You are a luxury goods cataloguing specialist. Analyze the bag photo(s) using the reference knowledge in the system prompt. Return ONLY valid JSON.

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
  {"rank":1,"brand":"Hermès","model":"Mini Kelly II Bi Color","confidence":93,"confidenceLabel":"High","estimatedValueEUR":28000,"detectedVariant":"Sellier","detectedColor":"Ultra Violet","detectedLeather":"Epsom","detectedHardware":"Palladium","detectedSize":"20","colorAccuracy":87,"alternativeColors":["Bleu Nuit","Bleu Indigo"],"detectedYear":"2022-2023","stampLetter":"Z","specialNotes":"Standard","isSpecialOrder":false,"isExotic":false,"isBiColor":true,"isTriColor":false,"isHSS":false,"secondaryColor":"Bleu Encre","tertiaryColor":null,"condition":"New","analysis":"Brief expert description.","imageSearchQuery":"Hermès Mini Kelly II 20 Sellier HSS Bi color Ultra Violet and Bleu Encre Epsom Palladium "},
  {"rank":2,"brand":"...","model":"...","confidence":85,"confidenceLabel":"Medium","estimatedValueEUR":0,"detectedVariant":"...","detectedColor":"...","detectedLeather":"...","detectedHardware":"...","detectedSize":"...","colorAccuracy":78,"alternativeColors":["...","..."],"detectedYear":"...","stampLetter":null,"specialNotes":"...","isSpecialOrder":false,"isExotic":false,"isBiColor":false,"isTriColor":false,"isHSS":false,"secondaryColor":null,"tertiaryColor":null,"condition":"...","analysis":"...","imageSearchQuery":"..."},
  {"rank":3,"brand":"...","model":"...","confidence":70,"confidenceLabel":"Low","estimatedValueEUR":0,"detectedVariant":"...","detectedColor":"...","detectedLeather":"...","detectedHardware":"...","detectedSize":"...","colorAccuracy":75,"alternativeColors":["...","..."],"detectedYear":"...","stampLetter":null,"specialNotes":"...","isSpecialOrder":false,"isExotic":false,"isBiColor":false,"isTriColor":false,"isHSS":false,"secondaryColor":null,"tertiaryColor":null,"condition":"...","analysis":"...","imageSearchQuery":"..."},
  {"rank":4,"brand":"...","model":"...","confidence":60,"confidenceLabel":"Low","estimatedValueEUR":0,"detectedVariant":"...","detectedColor":"...","detectedLeather":"...","detectedHardware":"...","detectedSize":"...","colorAccuracy":71,"alternativeColors":["...","..."],"detectedYear":"...","stampLetter":null,"specialNotes":"...","isSpecialOrder":false,"isExotic":false,"isBiColor":false,"isTriColor":false,"isHSS":false,"secondaryColor":null,"tertiaryColor":null,"condition":"...","analysis":"...","imageSearchQuery":"..."}
]}

IMPORTANT: 4 matches always. estimatedValueEUR = 2025 EU resale market. Special Order +30-200%. Exotic leather +300-1000%.'''


async def identify_bag(photos: list, photo_mimes: list):
    image_content = [
        {
            "type": "image_url",
            "image_url": {
                "url": f"data:{mime};base64,{b64}",
                "detail": "auto"
            }
        }
        for b64, mime in zip(photos, photo_mimes)
    ]

    content = [{"type": "text", "text": PROMPT}] + image_content

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
                        "content": "You are a luxury goods cataloguing assistant specializing in product classification for insurance and resale inventory purposes. Use this reference knowledge for bag attribute extraction:\n\n{KNOWLEDGE_BASE}\n\nAlways return valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": content
                    }
                ]
            }
        )
        res.raise_for_status()
        data = res.json()

        # ← ADD THIS: print full response to see what went wrong
        print("OpenAI raw response:", data)

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
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as e:
            print("JSON parse error:", e)
            print("Raw text was:", text)
            raise HTTPException(
                status_code=422, detail=f"Failed to parse AI response: {str(e)}")
        return parsed.get("matches", [])
