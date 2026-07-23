from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from src.models.warehouse import MovementType

class WarehouseItemBase(BaseModel):
    name: str = Field(..., max_length=100)
    quantity: float = Field(..., gt=0)
    movement_type: MovementType
    person: str = Field(..., max_length=100)

class WarehouseItemCreate(WarehouseItemBase):
    pass

class WarehouseItemUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    quantity: Optional[float] = Field(None, gt=0)
    movement_type: Optional[MovementType] = None
    person: Optional[str] = Field(None, max_length=100)

class WarehouseItemResponse(WarehouseItemBase):
    id: int
    date: datetime
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True