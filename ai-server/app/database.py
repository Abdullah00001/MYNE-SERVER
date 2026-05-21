from motor.motor_asyncio import AsyncIOMotorClient
from app.config import MONGODB_URL, DB_NAME

client = AsyncIOMotorClient(MONGODB_URL)
db = client[DB_NAME]
usercollections = db["usercollections"]

# ADD THESE TWO:
bags_collection = db["bags"]


async def setup_indexes():
    await bags_collection.create_index([
        ("brand", 1),
        ("model", 1),
        ("color", 1),
    ])
