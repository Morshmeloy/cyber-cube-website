from typing import List, Tuple
from pathlib import Path
from fastapi import HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from src.repositories.document_repository import DocumentRepository
from src.repositories.audit_repository import AuditRepository
from src.schemas.documents import DocumentResponse, DocumentPageResponse, UserDocumentsSummary
from src.models.user import User
from src.models.documents import Document
from src.services.document_storage import save_uploaded_file, get_file_path

PREVIEWABLE_CONTENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
}


def is_document_previewable(content_type: str) -> bool:
    return content_type in PREVIEWABLE_CONTENT_TYPES


def _document_to_response(doc: Document) -> DocumentResponse:
    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        original_filename=doc.original_filename,
        content_type=doc.content_type,
        size_bytes=doc.size_bytes,
        is_previewable=is_document_previewable(doc.content_type),
        created_at=doc.created_at,
        user_id=doc.user_id,
        username=doc.user.username,
    )


def _can_view_all(current_user: User) -> bool:
    return current_user.role.is_system or current_user.role.can_view_all_documents


class DocumentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.document_repo = DocumentRepository(db)
        self.audit_repo = AuditRepository(db)

    async def upload(self, file: UploadFile, title: str, current_user: User) -> DocumentResponse:
        stored_filename, size_bytes = await save_uploaded_file(file)
        doc = await self.document_repo.create(
            user_id=current_user.id,
            title=title,
            stored_filename=stored_filename,
            original_filename=file.filename or stored_filename,
            content_type=file.content_type or "application/octet-stream",
            size_bytes=size_bytes,
        )
        doc.user = current_user
        await self.audit_repo.log(
            user_id=current_user.id,
            action="document_uploaded",
            entity_type="document",
            entity_id=doc.id,
            details={"title": title, "original_filename": doc.original_filename},
        )
        return _document_to_response(doc)

    async def list_my_documents(self, current_user: User, page: int = 1, page_size: int = 10) -> DocumentPageResponse:
        docs, total = await self.document_repo.list_for_user(current_user.id, page, page_size)
        return DocumentPageResponse(items=[_document_to_response(d) for d in docs], total=total, page=page, page_size=page_size)

    async def list_roster(self, current_user: User) -> List[UserDocumentsSummary]:
        if not _can_view_all(current_user):
            return []
        rows = await self.document_repo.list_users_with_counts(current_user.id)
        return [
            UserDocumentsSummary(id=u.id, username=u.username, full_name=u.full_name, document_count=count)
            for u, count in rows
        ]

    async def list_documents_for_user(
        self, target_user_id: int, current_user: User, page: int = 1, page_size: int = 10
    ) -> DocumentPageResponse:
        if target_user_id != current_user.id and not _can_view_all(current_user):
            raise HTTPException(status_code=403, detail="Нет доступа к документам этого пользователя")
        docs, total = await self.document_repo.list_for_user(target_user_id, page, page_size)
        return DocumentPageResponse(items=[_document_to_response(d) for d in docs], total=total, page=page, page_size=page_size)

    async def get_document_file(self, document_id: int, current_user: User) -> Tuple[Document, Path]:
        doc = await self.document_repo.get_by_id(document_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Документ не найден")
        if doc.user_id != current_user.id and not _can_view_all(current_user):
            raise HTTPException(status_code=403, detail="Нет доступа к этому документу")
        return doc, get_file_path(doc.stored_filename)
