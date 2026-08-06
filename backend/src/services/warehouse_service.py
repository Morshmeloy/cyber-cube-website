from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from src.repositories.warehouse_repository import (
    NomenclatureRepository,
    StockOperationRepository,
)
from src.repositories.audit_repository import AuditRepository
from src.schemas.warehouse import (
    StockOperationUpdate,
    BatchOperationCreate,
    NomenclatureResponse,
    NomenclaturePageResponse,
    SyncResult,
    StockOperationResponse,
    StockOperationPageResponse,
    ConfirmResult,
)
from src.schemas.audit import AuditLogResponse
from src.schemas.onec import SyncStatusResponse
from src.models.user import User
from src.models.warehouse import OperationType, StockOperation
from src.models.audit import AuditLog
from src.services.excel_service import (
    build_operations_export,
    build_requirement_invoice_export,
)
from src.services.onec_client import fetch_nomenclature, fetch_balances


def _require(current_user: User, flag: str, message: str) -> None:
    if not (current_user.role.is_system or getattr(current_user.role, flag)):
        raise HTTPException(status_code=403, detail=message)


def _require_view(current_user: User) -> None:
    _require(current_user, "can_view_warehouse", "Нет доступа к складу")


def _require_ops(current_user: User) -> None:
    _require(
        current_user,
        "can_manage_warehouse_operations",
        "Нет доступа к операциям склада",
    )


def _require_sync(current_user: User) -> None:
    _require(current_user, "can_sync_warehouse_1c", "Нет доступа к синхронизации с 1С")


def _operation_to_response(op: StockOperation) -> StockOperationResponse:
    return StockOperationResponse(
        id=op.id,
        uuid=op.uuid,
        batch_id=op.batch_id,
        nomenclature_id=op.nomenclature_id,
        nomenclature_name=op.nomenclature.name,
        quantity=op.quantity,
        operation_type=op.operation_type.value,
        person=op.person,
        destination=op.destination,
        user_id=op.user_id,
        username=op.user.username,
        created_at=op.created_at,
        exported_at=op.exported_at,
        confirmed_in_1c_at=op.confirmed_in_1c_at,
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

    async def list_nomenclature(
        self,
        current_user: User,
        query: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> NomenclaturePageResponse:
        _require_view(current_user)
        items, total = await self.nomenclature_repo.search(
            query=query, page=page, page_size=page_size
        )
        portal_totals = await self.nomenclature_repo.portal_quantity_map()
        responses = [
            NomenclatureResponse(
                id=item.id,
                name=item.name,
                code=item.code,
                unit=item.unit,
                base_quantity=item.base_quantity,
                portal_quantity=portal_totals.get(item.id, 0),
                total_quantity=item.base_quantity + portal_totals.get(item.id, 0),
                base_synced_at=item.base_synced_at,
                created_at=item.created_at,
            )
            for item in items
        ]
        return NomenclaturePageResponse(
            items=responses, total=total, page=page, page_size=page_size
        )

    async def sync_from_1c(self, current_user: User) -> SyncResult:
        _require_sync(current_user)
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

    async def get_sync_status(self, current_user: User) -> SyncStatusResponse:
        _require_view(current_user)
        latest = await self.audit_repo.get_latest_by_action("nomenclature_synced")
        return SyncStatusResponse(last_synced_at=latest.created_at if latest else None)

    async def export_operations(
        self, current_user: User, include_exported: bool = False
    ) -> bytes:
        _require_ops(current_user)
        if include_exported:
            operations = await self.operation_repo.get_all(limit=10000)
        else:
            operations = await self.operation_repo.get_unexported(limit=10000)
        content = build_operations_export(operations)
        if not include_exported:
            await self.operation_repo.mark_exported([op.id for op in operations])
        await self.audit_repo.log(
            user_id=current_user.id,
            action="operations_exported",
            entity_type="stock_operation",
            details={
                "count": len(operations),
                "mode": "all" if include_exported else "new",
            },
        )
        return content

    async def export_selected_operations(
        self,
        ids: list[int],
        current_user: User,
        *,
        invoice_number: str | None = None,
        contract_name: str | None = None,
        released_by: str | None = None,
        received_by: str | None = None,
    ) -> bytes:
        """Экспорт конкретно выбранных операций (поиск+фильтры на фронте, чекбоксы) —
        в отличие от export_operations (всё непереданное/всё), тут явный список id."""
        _require_ops(current_user)
        operations = await self.operation_repo.get_by_ids(ids)
        if not operations:
            raise HTTPException(status_code=404, detail="Операции не найдены")
        content = build_requirement_invoice_export(
            operations,
            invoice_number=invoice_number,
            contract_name=contract_name,
            released_by=released_by,
            received_by=received_by,
        )
        await self.operation_repo.mark_exported([op.id for op in operations])
        await self.audit_repo.log(
            user_id=current_user.id,
            action="operations_exported",
            entity_type="stock_operation",
            details={"count": len(operations), "ids": [op.id for op in operations]},
        )
        return content

    async def create_batch_operation(
        self, data: BatchOperationCreate, current_user: User
    ) -> list[StockOperationResponse]:
        """Несколько позиций (номенклатура+количество) одним действием — все строки
        получают общий batch_id (см. StockOperationRepository.create_batch)."""
        _require_ops(current_user)

        # Резолвим номенклатуру и суммируем количество по одной и той же позиции
        # в пределах пачки — иначе проверка остатка по каждой строке независимо
        # пропустит превышение, если одна и та же позиция встретилась дважды.
        resolved_lines: list[tuple[int, str, float]] = []
        totals_by_id: dict[int, float] = {}
        names_by_id: dict[int, str] = {}
        for line in data.lines:
            nomenclature = await self.nomenclature_repo.get_or_create(
                line.nomenclature_name
            )
            resolved_lines.append((nomenclature.id, nomenclature.name, line.quantity))
            totals_by_id[nomenclature.id] = (
                totals_by_id.get(nomenclature.id, 0) + line.quantity
            )
            names_by_id[nomenclature.id] = nomenclature.name

        if data.operation_type == "issue":
            for nomenclature_id, total_qty in totals_by_id.items():
                nomenclature = await self.nomenclature_repo.get_by_id(nomenclature_id)
                portal_qty = await self.nomenclature_repo.portal_quantity_for(
                    nomenclature_id
                )
                available = nomenclature.base_quantity + portal_qty
                if total_qty > available:
                    raise HTTPException(
                        status_code=422,
                        detail=(
                            f"Недостаточно товара «{names_by_id[nomenclature_id]}» "
                            f"на складе: доступно {available}, запрошено {total_qty}"
                        ),
                    )

        rows, batch_id = await self.operation_repo.create_batch(
            lines=[(nid, qty) for nid, _, qty in resolved_lines],
            operation_type=OperationType(data.operation_type),
            person=data.person,
            destination=data.destination,
            user_id=current_user.id,
        )

        for row in rows:
            await self.audit_repo.log(
                user_id=current_user.id,
                action="operation_created",
                entity_type="stock_operation",
                entity_id=row.id,
                details={
                    "nomenclature": names_by_id[row.nomenclature_id],
                    "quantity": row.quantity,
                    "operation_type": data.operation_type,
                    "batch_id": str(batch_id),
                },
            )

        loaded = await self.operation_repo.get_by_ids([row.id for row in rows])
        return [_operation_to_response(op) for op in loaded]

    async def list_operations(
        self,
        current_user: User,
        query: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        operation_type: str | None = None,
        person: str | None = None,
        destination: str | None = None,
        export_status: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> StockOperationPageResponse:
        _require_view(current_user)
        operations, total = await self.operation_repo.search(
            query=query,
            date_from=date_from,
            date_to=date_to,
            operation_type=OperationType(operation_type) if operation_type else None,
            person=person,
            destination=destination,
            export_status=export_status,
            page=page,
            page_size=page_size,
        )
        return StockOperationPageResponse(
            items=[_operation_to_response(op) for op in operations],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def update_operation(
        self, operation_id: int, data: StockOperationUpdate, current_user: User
    ) -> StockOperationResponse:
        _require_ops(current_user)
        before = await self.operation_repo.get_by_id(operation_id)
        if not before:
            raise HTTPException(status_code=404, detail="Операция не найдена")

        new_quantity = data.quantity if data.quantity is not None else before.quantity
        new_type = (
            OperationType(data.operation_type)
            if data.operation_type
            else before.operation_type
        )
        portal_qty = await self.nomenclature_repo.portal_quantity_for(
            before.nomenclature_id
        )
        old_effect = (
            before.quantity
            if before.operation_type == OperationType.RETURN
            else -before.quantity
        )
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
        _require_ops(current_user)
        before = await self.operation_repo.get_by_id(operation_id)
        if not before:
            raise HTTPException(status_code=404, detail="Операция не найдена")

        portal_qty = await self.nomenclature_repo.portal_quantity_for(
            before.nomenclature_id
        )
        old_effect = (
            before.quantity
            if before.operation_type == OperationType.RETURN
            else -before.quantity
        )
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

    async def confirm_operations_in_1c(
        self, ids: list[int], current_user: User
    ) -> ConfirmResult:
        _require_ops(current_user)
        count = await self.operation_repo.set_confirmed(ids, True)
        await self.audit_repo.log(
            user_id=current_user.id,
            action="operations_confirmed_in_1c",
            entity_type="stock_operation",
            details={"ids": ids, "count": count},
        )
        return ConfirmResult(count=count)

    async def confirm_all_exported_in_1c(self, current_user: User) -> ConfirmResult:
        _require_ops(current_user)
        pending = await self.operation_repo.get_exported_unconfirmed()
        ids = [op.id for op in pending]
        count = await self.operation_repo.set_confirmed(ids, True)
        await self.audit_repo.log(
            user_id=current_user.id,
            action="operations_confirmed_in_1c",
            entity_type="stock_operation",
            details={"ids": ids, "count": count, "mode": "bulk"},
        )
        return ConfirmResult(count=count)

    async def unconfirm_operation_in_1c(
        self, operation_id: int, current_user: User
    ) -> StockOperationResponse:
        _require_ops(current_user)
        count = await self.operation_repo.set_confirmed([operation_id], False)
        if not count:
            raise HTTPException(status_code=404, detail="Операция не найдена")
        await self.audit_repo.log(
            user_id=current_user.id,
            action="operation_unconfirmed_in_1c",
            entity_type="stock_operation",
            entity_id=operation_id,
            details={},
        )
        updated = await self.operation_repo.get_by_id(operation_id)
        return _operation_to_response(updated)

    async def list_audit_log(self, current_user: User) -> list[AuditLogResponse]:
        _require_view(current_user)
        entries = await self.audit_repo.get_all()
        return [_audit_to_response(entry) for entry in entries]
