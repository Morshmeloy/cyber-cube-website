from urllib.parse import quote
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from src.core.database import get_db
from src.core.dependencies import get_current_user
from src.models.user import User
from src.services.document_service import DocumentService, is_document_previewable
from src.schemas.documents import DocumentResponse, DocumentPageResponse, UserDocumentsSummary

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("", response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DocumentService(db)
    return await service.upload(file, title, current_user)


@router.get("/me", response_model=DocumentPageResponse)
async def get_my_documents(
    page: int = 1,
    page_size: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DocumentService(db)
    return await service.list_my_documents(current_user, page=page, page_size=page_size)


@router.get("/users", response_model=List[UserDocumentsSummary])
async def get_documents_roster(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DocumentService(db)
    return await service.list_roster(current_user)


@router.get("/users/{user_id}", response_model=DocumentPageResponse)
async def get_documents_for_user(
    user_id: int,
    page: int = 1,
    page_size: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DocumentService(db)
    return await service.list_documents_for_user(user_id, current_user, page=page, page_size=page_size)


@router.get("/{document_id}/view")
async def view_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DocumentService(db)
    doc, path = await service.get_document_file(document_id, current_user)
    if not is_document_previewable(doc.content_type):
        raise HTTPException(status_code=400, detail="Этот формат нельзя просмотреть в браузере — только скачать")
    return FileResponse(
        path,
        media_type=doc.content_type,
        headers={"Content-Disposition": f"inline; filename*=UTF-8''{quote(doc.original_filename)}"},
    )


@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = DocumentService(db)
    doc, path = await service.get_document_file(document_id, current_user)
    return FileResponse(
        path,
        media_type=doc.content_type,
        headers={
            "Content-Disposition": (
                f"attachment; filename={doc.stored_filename}; filename*=UTF-8''{quote(doc.original_filename)}"
            )
        },
    )
