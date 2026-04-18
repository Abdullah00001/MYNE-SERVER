import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import bags
import uvicorn


app = FastAPI(title="MYNE Bag Intelligence API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bags.router, prefix="/api/v1")


def start():
    port = int(os.getenv("PORT", 8000))
    reload = os.getenv("ENV", "dev") == "dev"

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=reload
    )


if __name__ == "__main__":
    start()
