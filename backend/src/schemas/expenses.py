from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ExpenseResponse(BaseModel):
    id: int
    amount: Optional[float]
    description: Optional[str]
    original_filename: str
    content_type: str
    size_bytes: int
    is_previewable: bool
    created_at: datetime
    user_id: int
    username: str

    class Config:
        from_attributes = True


class ExpensePageResponse(BaseModel):
    items: list[ExpenseResponse]
    total: int
    page: int
    page_size: int


class UserExpensesSummary(BaseModel):
    id: int
    username: str
    full_name: Optional[str]
    expense_count: int
