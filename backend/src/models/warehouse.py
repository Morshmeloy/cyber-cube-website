from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from ..core.database import Base

class MovementType(str, enum.Enum):
    IN = "in"
    OUT = "out"

class WarehouseItem(Base):
    __tablename__ = "warehouse_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    quantity = Column(Float, nullable=False)
    movement_type = Column(SQLEnum(MovementType), nullable=False)
    date = Column(DateTime(timezone=True), server_default=func.now())
    person = Column(String(100), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="warehouse_items")