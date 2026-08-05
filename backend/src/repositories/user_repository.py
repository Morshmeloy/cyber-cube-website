from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from src.models.user import User
from src.schemas.auth import UserCreate


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_user(self, user_data: UserCreate, hashed_password: str) -> User:
        user = User(
            username=user_data.username,
            email=user_data.email,
            hashed_password=hashed_password,
            role_id=user_data.role_id,
            full_name=user_data.full_name,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def get_user_by_username(self, username: str) -> Optional[User]:
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.role))
            .where(User.username == username)
        )
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(
            select(User).options(selectinload(User.role)).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        result = await self.db.execute(
            select(User).options(selectinload(User.role)).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_all_users(self) -> List[User]:
        result = await self.db.execute(
            select(User).options(selectinload(User.role)).order_by(User.username)
        )
        return result.scalars().all()

    async def update_user(
        self,
        user: User,
        role_id: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> User:
        if role_id is not None:
            user.role_id = role_id
        if is_active is not None:
            user.is_active = is_active
        await self.db.commit()
        await self.db.refresh(user)
        return user
