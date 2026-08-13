from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    is_system = Column(Boolean, nullable=False, default=False)
    can_view_warehouse = Column(Boolean, nullable=False, default=False)
    can_manage_warehouse_operations = Column(Boolean, nullable=False, default=False)
    can_sync_warehouse_1c = Column(Boolean, nullable=False, default=False)
    can_manage_users = Column(Boolean, nullable=False, default=False)
    can_manage_roles = Column(Boolean, nullable=False, default=False)
    can_view_all_documents = Column(Boolean, nullable=False, default=False)
    can_view_all_expenses = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    users = relationship("User", back_populates="role")
