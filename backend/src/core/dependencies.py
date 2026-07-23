from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError
from src.core.database import get_db
from src.core.security import decode_token
from src.core.config import settings
from src.repositories.user_repository import UserRepository
from src.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token, settings.SECRET_KEY)
    if not payload:
        raise credentials_exception
    username = payload.get("sub")
    if not username:
        raise credentials_exception
    user_repo = UserRepository(db)
    user = await user_repo.get_user_by_username(username)
    if not user or not user.is_active:
        raise credentials_exception
    return user

async def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
