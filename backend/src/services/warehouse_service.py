from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from src.repositories.warehouse_repository import (
    NomenclatureRepository,
    StockOperationRepository,
)
from src.repositories.audit_repository import AuditRepository
from src.schemas.warehouse import (
    StockOperationCreate,
    StockOperationUpdate,
    NomenclatureResponse,
    SyncResult,
    StockOperationResponse,
)
from src.schemas.audit import AuditLogResponse
from src.schemas.onec import SyncStatusResponse
from src.models.user import User, UserRole
from src.models.warehouse import OperationType, StockOperation
from src.models.audit import AuditLog
from src.services.excel_service import build_operations_export
from src.services.onec_client import fetch_nomenclature, fetch_balances


def _require_admin(current_user: User) -> None:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Только администратор может выполнять это действие"
        )


def _operation_to_response(op: StockOperation) -> StockOperationResponse:
    return StockOperationResponse(
        id=op.id,
        uuid=op.uuid,
        nomenclature_id=op.nomenclature_id,
        nomenclature_name=op.nomenclature.name,
        quantity=op.quantity,
        operation_type=op.operation_type.value,
        person=op.person,
        destination=op.destination,
        user_id=op.user_id,
        username=op.user.username,
        created_at=op.created_at,
    )


def _audit_to_response(entry: AuditLog) -> AuditLogResponse:
    return AuditLogResponse(
        id=entry.id,
        user_id=entry.user_id,
        username=entry.user.username if entry.user else "система",
        action=entry.action,
        entity_type=entry.entity_type,
        entity_id=entry.entity_id,
        details=entry.details,
        created_at=entry.created_at,
    )


class WarehouseService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.nomenclature_repo = NomenclatureRepository(db)
        self.operation_repo = StockOperationRepository(db)
        self.audit_repo = AuditRepository(db)

    async def list_nomenclature(self) -> list[NomenclatureResponse]:
        items = await self.nomenclature_repo.get_all()
        portal_totals = await self.nomenclature_repo.portal_quantity_map()
        return [
            NomenclatureResponse(
                id=item.id,
                name=item.name,
                base_quantity=item.base_quantity,
                portal_quantity=portal_totals.get(item.id, 0),
                total_quantity=item.base_quantity + portal_totals.get(item.id, 0),
                base_synced_at=item.base_synced_at,
                created_at=item.created_at,
            )
            for item in items
        ]

    async def sync_from_1c(self, current_user: User) -> SyncResult:
        _require_admin(current_user)
        return await self._perform_sync(user_id=current_user.id)

    async def _perform_sync(self, user_id: int | None = None) -> SyncResult:
        items = await fetch_nomenclature()
        balances = await fetch_balances()
        added, updated = await self.nomenclature_repo.upsert_from_sync(items, balances)
        await self.audit_repo.log(
            user_id=user_id,
            action="nomenclature_synced",
            entity_type="nomenclature",
            details={"added": added, "updated": updated, "total": len(items)},
        )
        return SyncResult(added=added, updated=updated)

    async def get_sync_status(self) -> SyncStatusResponse:
        latest = await self.audit_repo.get_latest_by_action("nomenclature_synced")
        return SyncStatusResponse(last_synced_at=latest.created_at if latest else None)

    async def export_operations(self, current_user: User) -> bytes:
        operations = await self.operation_repo.get_all(limit=10000)
        content = build_operations_export(operations)
        await self.audit_repo.log(
            user_id=current_user.id,
            action="nomenclature_exported",
            entity_type="stock_operation",
            details={"count": len(operations)},
        )
        return content

    async def create_operation(
        self, data: StockOperationCreate, current_user: User
    ) -> StockOperationResponse:
        _require_admin(current_user)
        nomenclature = await self.nomenclature_repo.get_or_create(
            data.nomenclature_name
        )
        if data.operation_type == "issue":
            portal_qty = await self.nomenclature_repo.portal_quantity_for(nomenclature.id)
            available = nomenclature.base_quantity + portal_qty
            if data.quantity > available:
                raise HTTPException(
                    status_code=422,
                    detail=f"Недостаточно товара на складе: доступно {available}, запрошено {data.quantity}",
                )
        operation = await self.operation_repo.create(
            nomenclature_id=nomenclature.id,
            quantity=data.quantity,
            operation_type=OperationType(data.operation_type),
            person=data.person,
            destination=data.destination,
            user_id=current_user.id,
        )
        await self.audit_repo.log(
            user_id=current_user.id,
            action="operation_created",
            entity_type="stock_operation",
            entity_id=operation.id,
            details={
                "nomenclature": nomenclature.name,
                "quantity": data.quantity,
                "operation_type": data.operation_type,
            },
        )
        loaded = await self.operation_repo.get_by_id(operation.id)
        return _operation_to_response(loaded)

    async def list_operations(self) -> list[StockOperationResponse]:
        operations = await self.operation_repo.get_all()
        return [_operation_to_response(op) for op in operations]

    async def update_operation(
        self, operation_id: int, data: StockOperationUpdate, current_user: User
    ) -> StockOperationResponse:
        _require_admin(current_user)
        before = await self.operation_repo.get_by_id(operation_id)
        if not before:
            raise HTTPException(status_code=404, detail="Операция не найдена")

        new_quantity = data.quantity if data.quantity is not None else before.quantity
        new_type = (
            OperationType(data.operation_type) if data.operation_type else before.operation_type
        )
        portal_qty = await self.nomenclature_repo.portal_quantity_for(before.nomenclature_id)
        old_effect = before.quantity if before.operation_type == OperationType.RETURN else -before.quantity
        new_effect = new_quantity if new_type == OperationType.RETURN else -new_quantity
        nomenclature = await self.nomenclature_repo.get_by_id(before.nomenclature_id)
        total_after = nomenclature.base_quantity + portal_qty - old_effect + new_effect
        if total_after < 0:
            raise HTTPException(
                status_code=422,
                detail=f"После изменения остаток станет отрицательным ({total_after}).",
            )

        snapshot = {
            "nomenclature": nomenclature.name,
            "quantity": before.quantity,
            "operation_type": before.operation_type.value,
            "person": before.person,
            "destination": before.destination,
        }
        await self.operation_repo.update(
            operation_id,
            quantity=data.quantity,
            operation_type=(
                OperationType(data.operation_type) if data.operation_type else None
            ),
            person=data.person,
            destination=data.destination,
        )
        await self.audit_repo.log(
            user_id=current_user.id,
            action="operation_updated",
            entity_type="stock_operation",
            entity_id=operation_id,
            details={"before": snapshot},
        )
        updated = await self.operation_repo.get_by_id(operation_id)
        return _operation_to_response(updated)

    async def delete_operation(self, operation_id: int, current_user: User) -> None:
        _require_admin(current_user)
        before = await self.operation_repo.get_by_id(operation_id)
        if not before:
            raise HTTPException(status_code=404, detail="Операция не найдена")

        portal_qty = await self.nomenclature_repo.portal_quantity_for(before.nomenclature_id)
        old_effect = before.quantity if before.operation_type == OperationType.RETURN else -before.quantity
        nomenclature = await self.nomenclature_repo.get_by_id(before.nomenclature_id)
        total_after = nomenclature.base_quantity + portal_qty - old_effect
        if total_after < 0:
            raise HTTPException(
                status_code=422,
                detail="Нельзя удалить: без этой операции остаток товара станет отрицательным.",
            )

        deleted = await self.operation_repo.delete(operation_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Операция не найдена")
        await self.audit_repo.log(
            user_id=current_user.id,
            action="operation_deleted",
            entity_type="stock_operation",
            entity_id=operation_id,
            details={
                "nomenclature": nomenclature.name,
                "quantity": deleted.quantity,
                "operation_type": deleted.operation_type.value,
                "person": deleted.person,
                "destination": deleted.destination,
            },
        )

    async def list_audit_log(self) -> list[AuditLogResponse]:
        entries = await self.audit_repo.get_all()
        return [_audit_to_response(entry) for entry in entries]
