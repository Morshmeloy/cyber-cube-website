from urllib.parse import quote
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from src.core.database import get_db
from src.core.dependencies import get_current_user
from src.models.user import User
from src.services.expense_service import ExpenseService, is_expense_file_previewable
from src.schemas.expenses import ExpenseResponse, ExpensePageResponse, UserExpensesSummary

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.post("", response_model=ExpenseResponse, status_code=201)
async def upload_expense(
    file: UploadFile = File(...),
    amount: Optional[float] = Form(None),
    description: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ExpenseService(db)
    return await service.upload(file, amount, description, current_user)


@router.get("/me", response_model=ExpensePageResponse)
async def get_my_expenses(
    page: int = 1,
    page_size: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ExpenseService(db)
    return await service.list_my_expenses(current_user, page=page, page_size=page_size)


@router.get("/users", response_model=List[UserExpensesSummary])
async def get_expenses_roster(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ExpenseService(db)
    return await service.list_roster(current_user)


@router.get("/users/{user_id}", response_model=ExpensePageResponse)
async def get_expenses_for_user(
    user_id: int,
    page: int = 1,
    page_size: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ExpenseService(db)
    return await service.list_expenses_for_user(user_id, current_user, page=page, page_size=page_size)


@router.get("/{expense_id}/view")
async def view_expense_file(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ExpenseService(db)
    expense, path = await service.get_expense_file(expense_id, current_user)
    if not is_expense_file_previewable(expense.content_type):
        raise HTTPException(status_code=400, detail="Этот формат нельзя просмотреть в браузере — только скачать")
    return FileResponse(
        path,
        media_type=expense.content_type,
        headers={"Content-Disposition": f"inline; filename*=UTF-8''{quote(expense.original_filename)}"},
    )


@router.get("/{expense_id}/download")
async def download_expense_file(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ExpenseService(db)
    expense, path = await service.get_expense_file(expense_id, current_user)
    return FileResponse(
        path,
        media_type=expense.content_type,
        headers={
            "Content-Disposition": (
                f"attachment; filename={expense.stored_filename}; filename*=UTF-8''{quote(expense.original_filename)}"
            )
        },
    )
