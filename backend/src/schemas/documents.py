from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class DocumentResponse(BaseModel):
    id: int
    title: str
    original_filename: str
    content_type: str
    size_bytes: int
    is_previewable: bool
    created_at: datetime
    user_id: int
    username: str

    class Config:
        from_attributes = True


class DocumentPageResponse(BaseModel):
    items: list[DocumentResponse]
    total: int
    page: int
    page_size: int


class DocumentUploadForm(BaseModel):
    """Данные формы загрузки (сам файл идёт отдельно, через multipart — не сюда)."""
    title: str = Field(..., min_length=1, max_length=200)


class UserDocumentsSummary(BaseModel):
    id: int
    username: str
    full_name: Optional[str]
    document_count: int
