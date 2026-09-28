from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.auth_session import AuthSession
from src.models.user import User


class AuthSessionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_for_update(self, session_id: str) -> Optional[AuthSession]:
        result = await self.db.execute(
            select(AuthSession)
            .options(selectinload(AuthSession.user).selectinload(User.role))
            .where(AuthSession.id == session_id)
            .with_for_update()
        )
        return result.scalar_one_or_none()

    async def create(self, session: AuthSession) -> AuthSession:
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def save(self, session: AuthSession) -> None:
        self.db.add(session)
        await self.db.commit()
