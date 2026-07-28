from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class SyncStatusResponse(BaseModel):
    last_synced_at: Optional[datetime]
