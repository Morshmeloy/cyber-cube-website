from pydantic import BaseModel, EmailStr
from typing import Optional
from src.schemas.role import RoleResponse


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role_id: int
    full_name: Optional[str] = None


class UserUpdate(BaseModel):
    role_id: Optional[int] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: RoleResponse
    full_name: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: str
    role: str
    user_id: int
