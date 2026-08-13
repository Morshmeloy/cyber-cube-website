from typing import List, Optional, Tuple
from pathlib import Path
from fastapi import HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from src.repositories.expense_repository import ExpenseRepository
from src.repositories.audit_repository import AuditRepository
from src.schemas.expenses import ExpenseResponse, ExpensePageResponse, UserExpensesSummary
from src.models.user import User
from src.models.expenses import Expense
from src.services.expense_storage import save_uploaded_file, get_file_path

PREVIEWABLE_CONTENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
}


def is_expense_file_previewable(content_type: str) -> bool:
    return content_type in PREVIEWABLE_CONTENT_TYPES


def _expense_to_response(expense: Expense) -> ExpenseResponse:
    return ExpenseResponse(
        id=expense.id,
        amount=expense.amount,
        description=expense.description,
        original_filename=expense.original_filename,
        content_type=expense.content_type,
        size_bytes=expense.size_bytes,
        is_previewable=is_expense_file_previewable(expense.content_type),
        created_at=expense.created_at,
        user_id=expense.user_id,
        username=expense.user.username,
    )


def _can_view_all(current_user: User) -> bool:
    return current_user.role.is_system or current_user.role.can_view_all_expenses


class ExpenseService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.expense_repo = ExpenseRepository(db)
        self.audit_repo = AuditRepository(db)

    async def upload(
        self, file: UploadFile, amount: Optional[float], description: Optional[str], current_user: User
    ) -> ExpenseResponse:
        stored_filename, size_bytes = await save_uploaded_file(file)
        expense = await self.expense_repo.create(
            user_id=current_user.id,
            amount=amount,
            description=description,
            stored_filename=stored_filename,
            original_filename=file.filename or stored_filename,
            content_type=file.content_type or "application/octet-stream",
            size_bytes=size_bytes,
        )
        expense.user = current_user
        await self.audit_repo.log(
            user_id=current_user.id,
            action="expense_uploaded",
            entity_type="expense",
            entity_id=expense.id,
            details={"amount": amount, "original_filename": expense.original_filename},
        )
        return _expense_to_response(expense)

    async def list_my_expenses(self, current_user: User, page: int = 1, page_size: int = 10) -> ExpensePageResponse:
        expenses, total = await self.expense_repo.list_for_user(current_user.id, page, page_size)
        return ExpensePageResponse(items=[_expense_to_response(e) for e in expenses], total=total, page=page, page_size=page_size)

    async def list_roster(self, current_user: User) -> List[UserExpensesSummary]:
        if not _can_view_all(current_user):
            return []
        rows = await self.expense_repo.list_users_with_counts(current_user.id)
        return [
            UserExpensesSummary(id=u.id, username=u.username, full_name=u.full_name, expense_count=count)
            for u, count in rows
        ]

    async def list_expenses_for_user(
        self, target_user_id: int, current_user: User, page: int = 1, page_size: int = 10
    ) -> ExpensePageResponse:
        if target_user_id != current_user.id and not _can_view_all(current_user):
            raise HTTPException(status_code=403, detail="Нет доступа к расходам этого пользователя")
        expenses, total = await self.expense_repo.list_for_user(target_user_id, page, page_size)
        return ExpensePageResponse(items=[_expense_to_response(e) for e in expenses], total=total, page=page, page_size=page_size)

    async def get_expense_file(self, expense_id: int, current_user: User) -> Tuple[Expense, Path]:
        expense = await self.expense_repo.get_by_id(expense_id)
        if not expense:
            raise HTTPException(status_code=404, detail="Расход не найден")
        if expense.user_id != current_user.id and not _can_view_all(current_user):
            raise HTTPException(status_code=403, detail="Нет доступа к этому расходу")
        return expense, get_file_path(expense.stored_filename)
