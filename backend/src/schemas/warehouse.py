from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Literal
from uuid import UUID

OperationType = Literal["issue", "return"]


class NomenclatureResponse(BaseModel):
    id: int
    name: str
    code: Optional[str]
    unit: Optional[str]
    base_quantity: float
    portal_quantity: float
    total_quantity: float
    base_synced_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class NomenclaturePageResponse(BaseModel):
    items: list[NomenclatureResponse]
    total: int
    page: int
    page_size: int


class StockOperationCreate(BaseModel):
    nomenclature_name: str = Field(..., min_length=1, max_length=200)
    quantity: float = Field(..., gt=0)
    operation_type: OperationType
    person: str = Field(..., max_length=150)
    destination: str = Field(..., max_length=200)


class StockOperationUpdate(BaseModel):
    quantity: Optional[float] = Field(None, gt=0)
    operation_type: Optional[OperationType] = None
    person: Optional[str] = Field(None, max_length=150)
    destination: Optional[str] = Field(None, max_length=200)


class BatchOperationLine(BaseModel):
    nomenclature_name: str = Field(..., min_length=1, max_length=200)
    quantity: float = Field(..., gt=0)


class BatchOperationCreate(BaseModel):
    lines: list[BatchOperationLine] = Field(..., min_length=1)
    operation_type: OperationType
    person: str = Field(..., max_length=150)
    destination: str = Field(..., max_length=200)


class StockOperationResponse(BaseModel):
    id: int
    uuid: UUID
    batch_id: Optional[UUID]
    nomenclature_id: int
    nomenclature_name: str
    quantity: float
    operation_type: OperationType
    person: str
    destination: str
    user_id: int
    username: str
    created_at: datetime
    exported_at: Optional[datetime]
    confirmed_in_1c_at: Optional[datetime]

    class Config:
        from_attributes = True


class StockOperationPageResponse(BaseModel):
    items: list[StockOperationResponse]
    total: int
    page: int
    page_size: int


class ExportSelectedRequest(BaseModel):
    ids: list[int] = Field(..., min_length=1)
    invoice_number: Optional[str] = Field(None, max_length=50)
    contract_name: Optional[str] = Field(None, max_length=200)
    released_by: Optional[str] = Field(None, max_length=150)
    received_by: Optional[str] = Field(None, max_length=150)


class SyncResult(BaseModel):
    added: int
    updated: int


class ConfirmOperationsRequest(BaseModel):
    ids: list[int]


class ConfirmResult(BaseModel):
    count: int
