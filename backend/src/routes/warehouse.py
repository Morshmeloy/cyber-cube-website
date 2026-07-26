from fastapi import APIRouter, Depends, UploadFile, File, Query, Response
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
    ImportResult,
)
from src.schemas.audit import AuditLogResponse

router = APIRouter(prefix="/warehouse", tags=["warehouse"])

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/nomenclature", response_model=List[NomenclatureResponse])
async def get_nomenclature(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.list_nomenclature()


@router.post("/nomenclature/import", response_model=ImportResult)
async def import_nomenclature(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    content = await file.read()
    return await service.import_nomenclature(content, current_user)


@router.get("/nomenclature/export")
async def export_nomenclature(
    variant: str = Query("1c", pattern="^(1c|report)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    content = await service.export_balances(variant, current_user)
    filename = "ostatki_1c.xlsx" if variant == "1c" else "otchet_ostatki.xlsx"
    return Response(
        content=content,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/operations/export")
async def export_operations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    content = await service.export_operations(current_user)
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
    return await service.list_operations()


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


@router.get("/audit-log", response_model=List[AuditLogResponse])
async def get_audit_log(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.list_audit_log()
