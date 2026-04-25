import json
import os
import asyncio
import google.generativeai as genai
from fastapi import HTTPException

BASE_DIR = os.path.dirname(__file__)

with open(os.path.join(BASE_DIR, "knowledge.txt"), "r", encoding="utf-8") as f:
    KNOWLEDGE_BASE = f.read()

# 🔑 Set Gemini API Key
genai.configure(api_key="GEMINI_API_KEY")

# ⚙️ Model
model = genai.GenerativeModel("gemini-1.5-pro")


PROMPT = """You are a luxury goods cataloguing specialist. Analyze the bag photo(s) using the reference knowledge in the system prompt. Return ONLY valid JSON.

RULES:
- Be decisive. Never use "maybe", "possibly". If uncertain, pick closest match.
- detectedColor: EXACT official brand color name only. Never generic.
- detectedLeather: choose ONLY from allowed values in knowledge base.
- detectedModel: choose ONLY from allowed values in knowledge base.
- detectedVariant: Sellier / Retourne / Pochette / null if not applicable
- detectedSize: always integer (estimate if needed)
- stampLetter: Hermès only, otherwise null
- colorAccuracy: 0-100
- alternativeColors: 2-3 options if ambiguous, [] if certain

Return ONLY valid JSON in required structure.
"""


async def identify_bag(photos: list, photo_mimes: list):

    # 📦 Convert images for Gemini
    image_parts = [
        {
            "mime_type": mime,
            "data": b64
        }
        for b64, mime in zip(photos, photo_mimes)
    ]

    try:
        # ⚡ Run Gemini (sync SDK → use thread to avoid blocking FastAPI)
        response = await asyncio.to_thread(
            model.generate_content,
            [
                {"text": f"{PROMPT}\n\nREFERENCE KNOWLEDGE:\n{KNOWLEDGE_BASE}"},
                *image_parts
            ],
            {
                "temperature": 0.2,
                "max_output_tokens": 3000
            }
        )

        text = response.text

        if not text:
            raise HTTPException(
                status_code=422, detail="Gemini returned empty response")

        # 🧠 Parse JSON safely
        try:
            parsed = json.loads(text)
        except Exception as e:
            print("RAW GEMINI OUTPUT:\n", text)
            raise HTTPException(
                status_code=422,
                detail=f"Failed to parse JSON: {str(e)}"
            )

        return parsed.get("matches", [])

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
