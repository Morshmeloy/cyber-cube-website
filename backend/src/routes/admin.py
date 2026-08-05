from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from src.core.database import get_db
from src.core.dependencies import (
    get_current_user,
    require_manage_users,
    require_manage_roles,
)
from src.models.user import User
from src.services.admin_service import AdminService
from src.schemas.role import RoleCreate, RoleUpdate, RoleResponse
from src.schemas.auth import UserCreate, UserUpdate, UserResponse

router = APIRouter(prefix="/admin", tags=["admin"])


def _can_read_roles(current_user: User = Depends(get_current_user)) -> User:
    if not (
        current_user.role.is_system
        or current_user.role.can_manage_users
        or current_user.role.can_manage_roles
    ):
        raise HTTPException(status_code=403, detail="Нет доступа к списку ролей")
    return current_user


@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(
    current_user: User = Depends(_can_read_roles),
    db: AsyncSession = Depends(get_db),
):
    service = AdminService(db)
    return await service.list_roles()


@router.post("/roles", response_model=RoleResponse, status_code=201)
async def create_role(
    data: RoleCreate,
    current_user: User = Depends(require_manage_roles),
    db: AsyncSession = Depends(get_db),
):
    service = AdminService(db)
    return await service.create_role(data, current_user)


@router.patch("/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: int,
    data: RoleUpdate,
    current_user: User = Depends(require_manage_roles),
    db: AsyncSession = Depends(get_db),
):
    service = AdminService(db)
    return await service.update_role(role_id, data, current_user)


@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: int,
    current_user: User = Depends(require_manage_roles),
    db: AsyncSession = Depends(get_db),
):
    service = AdminService(db)
    await service.delete_role(role_id, current_user)
    return {"message": "Роль удалена"}


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(require_manage_users),
    db: AsyncSession = Depends(get_db),
):
    service = AdminService(db)
    return await service.list_users()


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    data: UserCreate,
    current_user: User = Depends(require_manage_users),
    db: AsyncSession = Depends(get_db),
):
    service = AdminService(db)
    return await service.create_user(data, current_user)


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    current_user: User = Depends(require_manage_users),
    db: AsyncSession = Depends(get_db),
):
    service = AdminService(db)
    return await service.update_user(user_id, data, current_user)
