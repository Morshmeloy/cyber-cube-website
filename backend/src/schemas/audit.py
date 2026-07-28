from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any


class AuditLogResponse(BaseModel):
    id: int
    user_id: int
    username: str
    action: str
    entity_type: str
    entity_id: Optional[int]
    details: Optional[dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True
