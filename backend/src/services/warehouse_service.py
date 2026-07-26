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
    ImportResult,
)
from src.models.user import User, UserRole
from src.models.warehouse import OperationType, StockOperation
from src.services.excel_service import (
    parse_balances_xlsx,
    build_balances_export_1c,
    build_balances_export_report,
    build_operations_export,
)


def _require_admin(current_user: User) -> None:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Только администратор может выполнять это действие"
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

    async def import_nomenclature(
        self, file_bytes: bytes, current_user: User
    ) -> ImportResult:
        _require_admin(current_user)
        rows = parse_balances_xlsx(file_bytes)
        added, updated = await self.nomenclature_repo.upsert_from_import(rows)
        await self.audit_repo.log(
            user_id=current_user.id,
            action="nomenclature_imported",
            entity_type="nomenclature",
            details={"added": added, "updated": updated, "rows": len(rows)},
        )
        return ImportResult(added=added, updated=updated, skipped_duplicates=0)

    async def export_balances(self, variant: str, current_user: User) -> bytes:
        items = await self.list_nomenclature()
        content = (
            build_balances_export_report(items)
            if variant == "report"
            else build_balances_export_1c(items)
        )
        await self.audit_repo.log(
            user_id=current_user.id,
            action="nomenclature_exported",
            entity_type="nomenclature",
            details={"variant": variant},
        )
        return content

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
    ) -> StockOperation:
        _require_admin(current_user)
        nomenclature = await self.nomenclature_repo.get_or_create(
            data.nomenclature_name
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
        return await self.operation_repo.get_by_id(operation.id)

    async def list_operations(self) -> list[StockOperation]:
        return await self.operation_repo.get_all()

    async def update_operation(
        self, operation_id: int, data: StockOperationUpdate, current_user: User
    ) -> StockOperation:
        _require_admin(current_user)
        before = await self.operation_repo.get_by_id(operation_id)
        if not before:
            raise HTTPException(status_code=404, detail="Операция не найдена")
        snapshot = {
            "quantity": before.quantity,
            "operation_type": before.operation_type.value,
            "person": before.person,
            "destination": before.destination,
        }
        updated = await self.operation_repo.update(
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
        return updated

    async def delete_operation(self, operation_id: int, current_user: User) -> None:
        _require_admin(current_user)
        deleted = await self.operation_repo.delete(operation_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Операция не найдена")
        await self.audit_repo.log(
            user_id=current_user.id,
            action="operation_deleted",
            entity_type="stock_operation",
            entity_id=operation_id,
            details={
                "nomenclature_id": deleted.nomenclature_id,
                "quantity": deleted.quantity,
                "operation_type": deleted.operation_type.value,
                "person": deleted.person,
                "destination": deleted.destination,
            },
        )

    async def list_audit_log(self):
        return await self.audit_repo.get_all()
