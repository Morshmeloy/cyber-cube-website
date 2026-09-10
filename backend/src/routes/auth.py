from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
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
from src.core.config import settings
from src.core.security import create_mail_access_token, decode_token
from src.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

MAIL_ACCESS_COOKIE = "d4_mail_access"


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
        role=user.role.name,
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(request: RefreshRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    new_access = await service.refresh_access(request.refresh_token)
    return RefreshResponse(access_token=new_access)


@router.post("/mail-session", status_code=status.HTTP_204_NO_CONTENT)
async def create_mail_session(
    response: Response,
    current_user: User = Depends(get_current_user),
):
    """Exchange a normal authenticated site session for an HttpOnly mail-gateway pass."""
    token = create_mail_access_token(
        {"sub": current_user.username, "user_id": current_user.id}
    )
    response.set_cookie(
        key=MAIL_ACCESS_COOKIE,
        value=token,
        max_age=settings.MAIL_ACCESS_EXPIRE_MINUTES * 60,
        secure=True,
        httponly=True,
        samesite="lax",
        path="/",
    )


@router.get("/mail-session/verify", status_code=status.HTTP_204_NO_CONTENT)
async def verify_mail_session(
    token: str | None = Cookie(default=None, alias=MAIL_ACCESS_COOKIE),
):
    """Small endpoint used only by Nginx auth_request before mail routes."""
    payload = decode_token(token, settings.SECRET_KEY) if token else None
    if not payload or payload.get("type") != "mail_access" or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)


@router.delete("/mail-session", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mail_session(response: Response):
    response.delete_cookie(
        key=MAIL_ACCESS_COOKIE,
        secure=True,
        httponly=True,
        samesite="lax",
        path="/",
    )
