from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class PriceStatus(BaseModel):
    trend: str = "stable"
    change_percentage: float = 0.0
    current_value: float
    currency: str = "USD"


class PurchaseInfo(BaseModel):
    purchase_price: Optional[float] = None
    currency: Optional[str] = "USD"
    purchase_location: Optional[str] = None
    seller_name: Optional[str] = None
    purchase_date: Optional[datetime] = None
    purchase_type: Optional[str] = None
    waiting_time_in_days: Optional[int] = None


class BagDocument(BaseModel):
    brand_id: str
    model_id: str
    user_id: str
    primary_image: Optional[str] = None
    images: Optional[List[str]] = []
    bag_color: Optional[str] = None
    leather_type: Optional[str] = None
    hardware_color: Optional[str] = None
    size: Optional[str] = None
    stamp_letter: Optional[str] = None
    special_variant: Optional[str] = None
    special_notes: Optional[str] = None
    condition_details: Optional[str] = None
    valuation_factors: Optional[str] = None
    price_status: Optional[PriceStatus] = None
    production_year: Optional[int] = None
    condition: Optional[str] = None
    purchase_info: Optional[PurchaseInfo] = None
    notes: Optional[str] = None
    receipt: Optional[str] = None
    is_archived: bool = False
    publish_status: str = "pending"
    last_price_updated_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class IdentifyRequest(BaseModel):
    photos: List[str]
    photo_mimes: List[str]
    user_id: str
