from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..core.database import Base


class AuthSession(Base):
    """Refresh-сессия одного браузера.

    В базе хранится только SHA-256 refresh-токена. Даже чтение базы не раскрывает
    действующий токен, а ротация делает уже использованный токен недействительным.
    """

    __tablename__ = "auth_sessions"

    id = Column(String(36), primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    refresh_token_hash = Column(String(64), nullable=False)
    remember_me = Column(Boolean, nullable=False, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_used_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="auth_sessions")
