from datetime import datetime
from urllib.parse import quote
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from src.core.database import get_db
from src.core.dependencies import get_current_user
from src.models.user import User
from src.services.warehouse_service import WarehouseService
from src.schemas.warehouse import (
    NomenclaturePageResponse,
    BatchOperationCreate,
    StockOperationUpdate,
    StockOperationResponse,
    StockOperationPageResponse,
    SyncResult,
    ConfirmOperationsRequest,
    ConfirmResult,
    ExportSelectedRequest,
    ExportListPageResponse,
    ExportDetailResponse,
    OperationType,
)
from src.schemas.audit import AuditLogResponse
from src.schemas.onec import SyncStatusResponse

router = APIRouter(prefix="/warehouse", tags=["warehouse"])

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/nomenclature", response_model=NomenclaturePageResponse)
async def get_nomenclature(
    query: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.list_nomenclature(
        current_user, query=query, page=page, page_size=page_size
    )


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


@router.post("/operations/export-selected")
async def export_selected_operations(
    data: ExportSelectedRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    content = await service.export_selected_operations(
        data.ids,
        current_user,
        invoice_number=data.invoice_number,
        contract_name=data.contract_name,
        released_by=data.released_by,
        received_by=data.received_by,
    )
    number_part = f"№ {data.invoice_number} " if data.invoice_number else ""
    filename = f"Требование-накладная {number_part}от {datetime.now().strftime('%d.%m.%Y')}.xlsx"
    return Response(
        content=content,
        media_type=XLSX_MEDIA_TYPE,
        headers={
            "Content-Disposition": (
                "attachment; filename=trebovanie-nakladnaya.xlsx; "
                f"filename*=UTF-8''{quote(filename)}"
            )
        },
    )


@router.get("/operations", response_model=StockOperationPageResponse)
async def get_operations(
    query: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    operation_type: Optional[OperationType] = None,
    person: Optional[str] = None,
    destination: Optional[str] = None,
    export_status: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.list_operations(
        current_user,
        query=query,
        date_from=date_from,
        date_to=date_to,
        operation_type=operation_type,
        person=person,
        destination=destination,
        export_status=export_status,
        page=page,
        page_size=page_size,
    )


@router.post("/operations", response_model=List[StockOperationResponse], status_code=201)
async def create_batch_operation(
    data: BatchOperationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.create_batch_operation(data, current_user)


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


@router.get("/exports", response_model=ExportListPageResponse)
async def list_exports(
    page: int = 1,
    page_size: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.list_exports(current_user, page=page, page_size=page_size)


@router.get("/exports/{export_id}", response_model=ExportDetailResponse)
async def get_export_detail(
    export_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.get_export_detail(export_id, current_user)


@router.get("/exports/{export_id}/download")
async def download_export(
    export_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    detail = await service.get_export_detail(export_id, current_user)
    content = await service.download_export(export_id, current_user)
    number_part = f"№ {detail.invoice_number} " if detail.invoice_number else ""
    filename = f"Требование-накладная {number_part}от {detail.created_at.strftime('%d.%m.%Y')}.xlsx"
    return Response(
        content=content,
        media_type=XLSX_MEDIA_TYPE,
        headers={
            "Content-Disposition": (
                "attachment; filename=trebovanie-nakladnaya.xlsx; "
                f"filename*=UTF-8''{quote(filename)}"
            )
        },
    )


@router.delete("/exports/{export_id}")
async def delete_export(
    export_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    await service.delete_export(export_id, current_user)
    return {"message": "Экспорт удалён"}
