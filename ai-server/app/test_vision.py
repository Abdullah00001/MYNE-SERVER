import httpx
import base64
import json

GOOGLE_VISION_API_KEY = "AIzaSyA6ePgo8zZonBaAoDqiRtcJYE4g1NUap5I"

# Load a test image
with open("C:\\Users\\Priya\\Desktop\\Priya-Projects\\MYNE-SERVER\\ai-server\\app\\pic1.webp", "rb") as f:
    image_data = base64.b64encode(f.read()).decode()

response = httpx.post(
    f"https://vision.googleapis.com/v1/images:annotate?key={GOOGLE_VISION_API_KEY}",
    json={
        "requests": [{
            "image": {"content": image_data},
            "features": [{"type": "WEB_DETECTION", "maxResults": 10}]
        }]
    }
)

result = response.json()
print("FULL RESULT:", json.dumps(result, indent=2))
web = result["responses"][0]["webDetection"]

print("BEST GUESS:", web.get("bestGuessLabels", []))
print("WEB ENTITIES:", web.get("webEntities", [])[:5])
print("PAGES:", [p["url"] for p in web.get("pagesWithMatchingImages", [])[:3]])
