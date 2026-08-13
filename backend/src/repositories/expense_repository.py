from typing import List, Optional, Tuple
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from src.models.expenses import Expense
from src.models.user import User


class ExpenseRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        *,
        user_id: int,
        amount: Optional[float],
        description: Optional[str],
        stored_filename: str,
        original_filename: str,
        content_type: str,
        size_bytes: int,
    ) -> Expense:
        expense = Expense(
            user_id=user_id,
            amount=amount,
            description=description,
            stored_filename=stored_filename,
            original_filename=original_filename,
            content_type=content_type,
            size_bytes=size_bytes,
        )
        self.db.add(expense)
        await self.db.commit()
        await self.db.refresh(expense)
        return expense

    async def list_for_user(
        self, user_id: int, page: int = 1, page_size: int = 10
    ) -> Tuple[List[Expense], int]:
        total = (
            await self.db.execute(select(func.count(Expense.id)).where(Expense.user_id == user_id))
        ).scalar_one()
        result = await self.db.execute(
            select(Expense)
            .options(selectinload(Expense.user))
            .where(Expense.user_id == user_id)
            .order_by(Expense.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return result.scalars().all(), total

    async def get_by_id(self, expense_id: int) -> Optional[Expense]:
        result = await self.db.execute(
            select(Expense).options(selectinload(Expense.user)).where(Expense.id == expense_id)
        )
        return result.scalar_one_or_none()

    async def list_users_with_counts(self, current_user_id: int) -> List[Tuple[User, int]]:
        """(User, кол-во расходов) по всем пользователям — текущий пользователь всегда
        первым в списке, остальные по алфавиту username."""
        current_user_first = case((User.id == current_user_id, 0), else_=1)
        result = await self.db.execute(
            select(User, func.count(Expense.id))
            .outerjoin(Expense, Expense.user_id == User.id)
            .group_by(User.id)
            .order_by(current_user_first, User.username)
        )
        return result.all()
