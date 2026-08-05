from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.repositories.user_repository import UserRepository
from src.schemas.auth import UserCreate, LoginRequest
from src.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from src.core.config import settings


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)

    async def register_user(self, user_data: UserCreate):
        if await self.user_repo.get_user_by_username(user_data.username):
            raise HTTPException(status_code=400, detail="Username already taken")
        if await self.user_repo.get_user_by_email(user_data.email):
            raise HTTPException(status_code=400, detail="Email already registered")

        hashed = get_password_hash(user_data.password)
        return await self.user_repo.create_user(user_data, hashed)

    async def authenticate_user(self, login_data: LoginRequest):
        user = await self.user_repo.get_user_by_username(login_data.username)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not verify_password(login_data.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="User is deactivated")
        return user

    def create_tokens(self, user) -> dict:
        data = {"sub": user.username, "user_id": user.id, "role": user.role.name}
        return {
            "access_token": create_access_token(data),
            "refresh_token": create_refresh_token(data),
        }

    async def refresh_access(self, refresh_token: str):
        payload = decode_token(refresh_token, settings.REFRESH_SECRET_KEY)
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        username = payload.get("sub")
        user = await self.user_repo.get_user_by_username(username)
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")
        return create_access_token(
            {"sub": user.username, "user_id": user.id, "role": user.role.name}
        )
