from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
import uuid
from ..core.database import Base


class OperationType(str, enum.Enum):
    ISSUE = "issue"
    RETURN = "return"


class Nomenclature(Base):
    __tablename__ = "nomenclature"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), unique=True, nullable=False, index=True)
    base_quantity = Column(Float, nullable=False, default=0)
    base_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    operations = relationship("StockOperation", back_populates="nomenclature")


class StockOperation(Base):
    __tablename__ = "stock_operations"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4)
    nomenclature_id = Column(Integer, ForeignKey("nomenclature.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    operation_type = Column(SQLEnum(OperationType), nullable=False)
    person = Column(String(150), nullable=False)
    destination = Column(String(200), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    nomenclature = relationship("Nomenclature", back_populates="operations")
    user = relationship("User", back_populates="stock_operations")
