import hashlib
import hmac
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from src.repositories.user_repository import UserRepository
from src.repositories.auth_session_repository import AuthSessionRepository
from src.models.auth_session import AuthSession
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
        self.session_repo = AuthSessionRepository(db)

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

    @staticmethod
    def _token_hash(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def _token_data(user) -> dict:
        return {"sub": user.username, "user_id": user.id, "role": user.role.name}

    async def create_session(self, user, remember_me: bool) -> dict:
        session_id = str(uuid.uuid4())
        lifetime_days = (
            settings.PERSISTENT_SESSION_EXPIRE_DAYS
            if remember_me
            else settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        lifetime = timedelta(days=lifetime_days)
        refresh_token = create_refresh_token(
            {**self._token_data(user), "sid": session_id}, expires_delta=lifetime
        )
        await self.session_repo.create(
            AuthSession(
                id=session_id,
                user_id=user.id,
                refresh_token_hash=self._token_hash(refresh_token),
                remember_me=remember_me,
                expires_at=datetime.now(timezone.utc) + lifetime,
            )
        )
        data = {"sub": user.username, "user_id": user.id, "role": user.role.name}
        return {
            "access_token": create_access_token(data),
            "refresh_token": refresh_token,
            "remember_me": remember_me,
        }

    async def refresh_session(self, refresh_token: str) -> dict:
        payload = decode_token(refresh_token, settings.REFRESH_SECRET_KEY)
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        session_id = payload.get("sid")
        if not session_id:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        session = await self.session_repo.get_for_update(session_id)
        now = datetime.now(timezone.utc)
        if (
            not session
            or session.revoked_at is not None
            or session.expires_at <= now
            or not hmac.compare_digest(
                session.refresh_token_hash, self._token_hash(refresh_token)
            )
        ):
            raise HTTPException(status_code=401, detail="Invalid refresh session")

        user = session.user
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")

        remaining = session.expires_at - now
        rotated_refresh = create_refresh_token(
            {**self._token_data(user), "sid": session.id}, expires_delta=remaining
        )
        session.refresh_token_hash = self._token_hash(rotated_refresh)
        session.last_used_at = now
        await self.session_repo.save(session)
        return {
            "access_token": create_access_token(self._token_data(user)),
            "refresh_token": rotated_refresh,
            "remember_me": session.remember_me,
        }

    async def revoke_session(self, refresh_token: str) -> None:
        payload = decode_token(refresh_token, settings.REFRESH_SECRET_KEY)
        session_id = payload.get("sid") if payload else None
        if not session_id:
            return
        session = await self.session_repo.get_for_update(session_id)
        if session and session.revoked_at is None:
            session.revoked_at = datetime.now(timezone.utc)
            await self.session_repo.save(session)
