from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
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
    source_guid = Column(String(36), unique=True, nullable=True, index=True)
    code = Column(String(50), nullable=True)
    unit = Column(String(20), nullable=True)
    base_quantity = Column(Float, nullable=False, default=0)
    base_synced_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    operations = relationship("StockOperation", back_populates="nomenclature")


class StockOperation(Base):
    __tablename__ = "stock_operations"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4)
    batch_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    nomenclature_id = Column(Integer, ForeignKey("nomenclature.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    operation_type = Column(SQLEnum(OperationType), nullable=False)
    person = Column(String(150), nullable=False)
    destination = Column(String(200), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    exported_at = Column(DateTime(timezone=True), nullable=True)
    confirmed_in_1c_at = Column(DateTime(timezone=True), nullable=True)

    nomenclature = relationship("Nomenclature", back_populates="operations")
    user = relationship("User", back_populates="stock_operations")


class Export(Base):
    __tablename__ = "exports"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), nullable=True)
    contract_name = Column(String(200), nullable=True)
    released_by = Column(String(150), nullable=True)
    received_by = Column(String(150), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    items = relationship(
        "ExportItem", back_populates="export", cascade="all, delete-orphan"
    )


class ExportItem(Base):
    __tablename__ = "export_items"

    id = Column(Integer, primary_key=True, index=True)
    export_id = Column(
        Integer,
        ForeignKey("exports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    stock_operation_id = Column(
        Integer, ForeignKey("stock_operations.id"), nullable=False, index=True
    )

    export = relationship("Export", back_populates="items")
    stock_operation = relationship("StockOperation")
