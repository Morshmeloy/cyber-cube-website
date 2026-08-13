from typing import List, Optional, Tuple
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from src.models.documents import Document
from src.models.user import User


class DocumentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        *,
        user_id: int,
        title: str,
        stored_filename: str,
        original_filename: str,
        content_type: str,
        size_bytes: int,
    ) -> Document:
        doc = Document(
            user_id=user_id,
            title=title,
            stored_filename=stored_filename,
            original_filename=original_filename,
            content_type=content_type,
            size_bytes=size_bytes,
        )
        self.db.add(doc)
        await self.db.commit()
        await self.db.refresh(doc)
        return doc

    async def list_for_user(
        self, user_id: int, page: int = 1, page_size: int = 10
    ) -> Tuple[List[Document], int]:
        total = (
            await self.db.execute(select(func.count(Document.id)).where(Document.user_id == user_id))
        ).scalar_one()
        result = await self.db.execute(
            select(Document)
            .options(selectinload(Document.user))
            .where(Document.user_id == user_id)
            .order_by(Document.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return result.scalars().all(), total

    async def get_by_id(self, document_id: int) -> Optional[Document]:
        result = await self.db.execute(
            select(Document).options(selectinload(Document.user)).where(Document.id == document_id)
        )
        return result.scalar_one_or_none()

    async def list_users_with_counts(self, current_user_id: int) -> List[Tuple[User, int]]:
        """(User, кол-во документов) по всем пользователям — текущий пользователь всегда
        первым в списке, остальные по алфавиту username."""
        current_user_first = case((User.id == current_user_id, 0), else_=1)
        result = await self.db.execute(
            select(User, func.count(Document.id))
            .outerjoin(Document, Document.user_id == User.id)
            .group_by(User.id)
            .order_by(current_user_first, User.username)
        )
        return result.all()
