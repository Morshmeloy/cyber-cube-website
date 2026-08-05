from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from src.core.database import get_db
from src.core.dependencies import get_current_user
from src.models.user import User
from src.services.warehouse_service import WarehouseService
from src.schemas.warehouse import (
    NomenclatureResponse,
    StockOperationCreate,
    StockOperationUpdate,
    StockOperationResponse,
    SyncResult,
    ConfirmOperationsRequest,
    ConfirmResult,
)
from src.schemas.audit import AuditLogResponse
from src.schemas.onec import SyncStatusResponse

router = APIRouter(prefix="/warehouse", tags=["warehouse"])

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/nomenclature", response_model=List[NomenclatureResponse])
async def get_nomenclature(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.list_nomenclature(current_user)


@router.post("/onec/sync", response_model=SyncResult)
async def sync_nomenclature(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.sync_from_1c(current_user)


@router.get("/onec/sync-status", response_model=SyncStatusResponse)
async def get_sync_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.get_sync_status(current_user)


@router.get("/operations/export")
async def export_operations(
    include_exported: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    content = await service.export_operations(
        current_user, include_exported=include_exported
    )
    return Response(
        content=content,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=operacii.xlsx"},
    )


@router.get("/operations", response_model=List[StockOperationResponse])
async def get_operations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.list_operations(current_user)


@router.post("/operations", response_model=StockOperationResponse, status_code=201)
async def create_operation(
    data: StockOperationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.create_operation(data, current_user)


@router.put("/operations/{operation_id}", response_model=StockOperationResponse)
async def update_operation(
    operation_id: int,
    data: StockOperationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.update_operation(operation_id, data, current_user)


@router.delete("/operations/{operation_id}")
async def delete_operation(
    operation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    await service.delete_operation(operation_id, current_user)
    return {"message": "Операция удалена"}


@router.post("/operations/confirm-in-1c", response_model=ConfirmResult)
async def confirm_operations_in_1c(
    data: ConfirmOperationsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.confirm_operations_in_1c(data.ids, current_user)


@router.post("/operations/confirm-all-exported", response_model=ConfirmResult)
async def confirm_all_exported(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.confirm_all_exported_in_1c(current_user)


@router.post(
    "/operations/{operation_id}/unconfirm-in-1c", response_model=StockOperationResponse
)
async def unconfirm_operation_in_1c(
    operation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.unconfirm_operation_in_1c(operation_id, current_user)


@router.get("/audit-log", response_model=List[AuditLogResponse])
async def get_audit_log(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.list_audit_log(current_user)
