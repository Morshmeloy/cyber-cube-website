from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from src.models.role import Role
from src.models.user import User


class RoleRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(self) -> List[Role]:
        result = await self.db.execute(select(Role).order_by(Role.name))
        return result.scalars().all()

    async def get_by_id(self, role_id: int) -> Optional[Role]:
        result = await self.db.execute(select(Role).where(Role.id == role_id))
        return result.scalar_one_or_none()

    async def create(self, name: str, **flags) -> Role:
        role = Role(name=name, **flags)
        self.db.add(role)
        await self.db.commit()
        await self.db.refresh(role)
        return role

    async def update(self, role: Role, **fields) -> Role:
        for key, value in fields.items():
            if value is not None:
                setattr(role, key, value)
        await self.db.commit()
        await self.db.refresh(role)
        return role

    async def has_users(self, role_id: int) -> bool:
        result = await self.db.execute(
            select(User.id).where(User.role_id == role_id).limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def delete(self, role: Role) -> None:
        await self.db.delete(role)
        await self.db.commit()
