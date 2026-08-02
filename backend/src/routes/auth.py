from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.services.auth_service import AuthService
from src.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RefreshResponse,
    UserResponse,
)
from src.core.dependencies import get_current_user
from src.schemas.auth import UserResponse
from src.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.post("/login", response_model=LoginResponse)
async def login(login_data: LoginRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    user = await service.authenticate_user(login_data)
    tokens = service.create_tokens(user)
    return LoginResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        role=user.role.value,
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(request: RefreshRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    new_access = await service.refresh_access(request.refresh_token)
    return RefreshResponse(access_token=new_access)
