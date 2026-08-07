from datetime import datetime
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import func
from typing import List, Optional
from src.models.warehouse import (
    Nomenclature,
    StockOperation,
    OperationType,
    Export,
    ExportItem,
)


def normalize_name(name: str) -> str:
    return " ".join(name.strip().split()).lower()


class NomenclatureRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(self) -> List[Nomenclature]:
        result = await self.db.execute(
            select(Nomenclature)
            .where(Nomenclature.is_active == True)
            .order_by(Nomenclature.name)
        )
        return result.scalars().all()

    async def search(
        self, query: Optional[str] = None, page: int = 1, page_size: int = 10
    ) -> tuple[List[Nomenclature], int]:
        """Поиск по названию/коду (без учёта регистра) + пагинация, только активные."""
        conditions = [Nomenclature.is_active == True]
        if query:
            pattern = f"%{query.strip().lower()}%"
            conditions.append(
                func.lower(Nomenclature.name).like(pattern)
                | func.lower(Nomenclature.code).like(pattern)
            )
        total = (
            await self.db.execute(
                select(func.count(Nomenclature.id)).where(*conditions)
            )
        ).scalar_one()
        result = await self.db.execute(
            select(Nomenclature)
            .where(*conditions)
            .order_by(Nomenclature.name)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return result.scalars().all(), total

    async def get_by_id(self, nomenclature_id: int) -> Optional[Nomenclature]:
        result = await self.db.execute(
            select(Nomenclature).where(Nomenclature.id == nomenclature_id)
        )
        return result.scalar_one_or_none()

    async def find_by_name(self, name: str) -> Optional[Nomenclature]:
        normalized_column = func.lower(
            func.trim(func.regexp_replace(Nomenclature.name, r"\s+", " ", "g"))
        )
        result = await self.db.execute(
            select(Nomenclature).where(normalized_column == normalize_name(name))
        )
        return result.scalar_one_or_none()

    async def get_or_create(self, name: str) -> Nomenclature:
        existing = await self.find_by_name(name)
        if existing:
            return existing
        item = Nomenclature(name=name.strip(), base_quantity=0)
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def portal_quantity_for(self, nomenclature_id: int) -> float:
        """Движение через портал по ОДНОЙ конкретной номенклатуре — без операций,
        уже подтверждённых как внесённые в 1С (иначе их эффект посчитается дважды,
        когда 1С отдаст base_quantity, уже учитывающий их)."""
        result = await self.db.execute(
            select(StockOperation).where(
                StockOperation.nomenclature_id == nomenclature_id,
                StockOperation.confirmed_in_1c_at.is_(None),
            )
        )
        total = 0.0
        for op_row in result.scalars().all():
            total += (
                op_row.quantity
                if op_row.operation_type == OperationType.RETURN
                else -op_row.quantity
            )
        return total

    async def portal_quantity_map(self) -> dict[int, float]:
        """{nomenclature_id: сумма возвратов минус выдач через портал}, без подтверждённых в 1С."""
        result = await self.db.execute(
            select(StockOperation).where(StockOperation.confirmed_in_1c_at.is_(None))
        )
        totals: dict[int, float] = {}
        for op_row in result.scalars().all():
            delta = (
                op_row.quantity
                if op_row.operation_type == OperationType.RETURN
                else -op_row.quantity
            )
            totals[op_row.nomenclature_id] = (
                totals.get(op_row.nomenclature_id, 0) + delta
            )
        return totals

    async def find_by_guid(self, source_guid: str) -> Optional[Nomenclature]:
        result = await self.db.execute(
            select(Nomenclature).where(Nomenclature.source_guid == source_guid)
        )
        return result.scalar_one_or_none()

    async def upsert_from_sync(
        self,
        items: list[tuple[str, str, str | None, str | None]],
        balances: dict[str, float],
    ) -> tuple[int, int]:
        """items: [(guid, название, код, единица_измерения), ...] из Catalog_Номенклатура.
        Возвращает (added, updated)."""
        if not items:
            raise ValueError(
                "fetch_nomenclature() вернул пустой список — синк остановлен, "
                "чтобы не заархивировать все позиции разом"
            )
        added = 0
        updated = 0
        synced_guids = {guid for guid, _, _, _ in items}
        for guid, name, code, unit in items:
            quantity = balances.get(guid, 0)
            existing = await self.find_by_guid(guid)
            if not existing:
                existing = await self.find_by_name(name)
            if existing:
                existing.name = name
                existing.source_guid = guid
                existing.code = code
                existing.unit = unit
                existing.base_quantity = quantity
                existing.base_synced_at = func.now()
                existing.is_active = True
                updated += 1
            else:
                self.db.add(
                    Nomenclature(
                        name=name,
                        source_guid=guid,
                        code=code,
                        unit=unit,
                        base_quantity=quantity,
                        base_synced_at=func.now(),
                    )
                )
                added += 1

        result = await self.db.execute(
            select(Nomenclature).where(
                Nomenclature.is_active == True,
                Nomenclature.source_guid.is_not(None),
                Nomenclature.source_guid.not_in(synced_guids) if synced_guids else True,
            )
        )
        for stale in result.scalars().all():
            stale.is_active = False

        await self.db.commit()
        return added, updated


class StockOperationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        nomenclature_id: int,
        quantity: float,
        operation_type: OperationType,
        person: str,
        destination: str,
        user_id: int,
    ) -> StockOperation:
        op_row = StockOperation(
            nomenclature_id=nomenclature_id,
            quantity=quantity,
            operation_type=operation_type,
            person=person,
            destination=destination,
            user_id=user_id,
        )
        self.db.add(op_row)
        await self.db.commit()
        await self.db.refresh(op_row)
        return op_row

    async def create_batch(
        self,
        lines: list[tuple[int, float]],
        operation_type: OperationType,
        person: str,
        destination: str,
        user_id: int,
    ) -> tuple[List[StockOperation], uuid.UUID]:
        """lines: [(nomenclature_id, quantity), ...] — несколько позиций одним действием,
        все строки получают общий batch_id (в т.ч. если позиция всего одна)."""
        batch_id = uuid.uuid4()
        rows = [
            StockOperation(
                nomenclature_id=nomenclature_id,
                quantity=quantity,
                operation_type=operation_type,
                person=person,
                destination=destination,
                user_id=user_id,
                batch_id=batch_id,
            )
            for nomenclature_id, quantity in lines
        ]
        self.db.add_all(rows)
        await self.db.commit()
        for row in rows:
            await self.db.refresh(row)
        return rows, batch_id

    async def get_by_ids(self, ids: list[int]) -> List[StockOperation]:
        if not ids:
            return []
        result = await self.db.execute(
            select(StockOperation)
            .options(
                selectinload(StockOperation.nomenclature),
                selectinload(StockOperation.user),
            )
            .where(StockOperation.id.in_(ids))
            .order_by(StockOperation.created_at)
        )
        return result.scalars().all()

    async def search(
        self,
        query: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        operation_type: Optional[OperationType] = None,
        person: Optional[str] = None,
        destination: Optional[str] = None,
        export_status: Optional[str] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> tuple[List[StockOperation], int]:
        """export_status: 'exported' | 'not_exported' | None (без фильтра по статусу)."""
        conditions = []
        if date_from:
            conditions.append(StockOperation.created_at >= date_from)
        if date_to:
            conditions.append(StockOperation.created_at <= date_to)
        if operation_type:
            conditions.append(StockOperation.operation_type == operation_type)
        if person:
            conditions.append(
                func.lower(StockOperation.person).like(f"%{person.strip().lower()}%")
            )
        if destination:
            conditions.append(
                func.lower(StockOperation.destination).like(
                    f"%{destination.strip().lower()}%"
                )
            )
        if export_status == "exported":
            conditions.append(StockOperation.exported_at.is_not(None))
        elif export_status == "not_exported":
            conditions.append(StockOperation.exported_at.is_(None))
        if query:
            pattern = f"%{query.strip().lower()}%"
            matched = await self.db.execute(
                select(Nomenclature.id).where(
                    func.lower(Nomenclature.name).like(pattern)
                    | func.lower(Nomenclature.code).like(pattern)
                )
            )
            nomenclature_ids = [row[0] for row in matched.all()]
            conditions.append(StockOperation.nomenclature_id.in_(nomenclature_ids))

        total = (
            await self.db.execute(
                select(func.count(StockOperation.id)).where(*conditions)
            )
        ).scalar_one()
        result = await self.db.execute(
            select(StockOperation)
            .options(
                selectinload(StockOperation.nomenclature),
                selectinload(StockOperation.user),
            )
            .where(*conditions)
            .order_by(StockOperation.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return result.scalars().all(), total

    async def get_all(self, skip: int = 0, limit: int = 200) -> List[StockOperation]:
        result = await self.db.execute(
            select(StockOperation)
            .options(
                selectinload(StockOperation.nomenclature),
                selectinload(StockOperation.user),
            )
            .order_by(StockOperation.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    async def get_unexported(self, limit: int = 10000) -> List[StockOperation]:
        result = await self.db.execute(
            select(StockOperation)
            .options(
                selectinload(StockOperation.nomenclature),
                selectinload(StockOperation.user),
            )
            .where(StockOperation.exported_at.is_(None))
            .order_by(StockOperation.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

    async def mark_exported(self, ids: list[int]) -> None:
        if not ids:
            return
        result = await self.db.execute(
            select(StockOperation).where(StockOperation.id.in_(ids))
        )
        for op_row in result.scalars().all():
            op_row.exported_at = func.now()
        await self.db.commit()

    async def get_exported_unconfirmed(self) -> List[StockOperation]:
        result = await self.db.execute(
            select(StockOperation)
            .options(
                selectinload(StockOperation.nomenclature),
                selectinload(StockOperation.user),
            )
            .where(
                StockOperation.exported_at.is_not(None),
                StockOperation.confirmed_in_1c_at.is_(None),
            )
        )
        return result.scalars().all()

    async def set_confirmed(self, ids: list[int], confirmed: bool) -> int:
        if not ids:
            return 0
        result = await self.db.execute(
            select(StockOperation).where(StockOperation.id.in_(ids))
        )
        rows = result.scalars().all()
        for op_row in rows:
            op_row.confirmed_in_1c_at = func.now() if confirmed else None
        await self.db.commit()
        return len(rows)

    async def get_by_id(self, operation_id: int) -> Optional[StockOperation]:
        result = await self.db.execute(
            select(StockOperation)
            .options(
                selectinload(StockOperation.nomenclature),
                selectinload(StockOperation.user),
            )
            .where(StockOperation.id == operation_id)
        )
        return result.scalar_one_or_none()

    async def update(self, operation_id: int, **fields) -> Optional[StockOperation]:
        op_row = await self.get_by_id(operation_id)
        if not op_row:
            return None
        for key, value in fields.items():
            if value is not None:
                setattr(op_row, key, value)
        await self.db.commit()
        await self.db.refresh(op_row)
        return op_row

    async def delete(self, operation_id: int) -> Optional[StockOperation]:
        op_row = await self.get_by_id(operation_id)
        if not op_row:
            return None
        await self.db.delete(op_row)
        await self.db.commit()
        return op_row


class ExportRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_page(self, page: int = 1, page_size: int = 10) -> tuple[list, int]:
        """Возвращает ([(Export, items_count), ...], total) — только активные (is_active) экспорты."""
        total = (
            await self.db.execute(
                select(func.count(Export.id)).where(Export.is_active.is_(True))
            )
        ).scalar_one()
        result = await self.db.execute(
            select(Export, func.count(ExportItem.id).label("items_count"))
            .outerjoin(ExportItem, ExportItem.export_id == Export.id)
            .options(selectinload(Export.user))
            .where(Export.is_active.is_(True))
            .group_by(Export.id)
            .order_by(Export.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return result.all(), total

    async def get_active(self, export_id: int) -> Optional[Export]:
        """Один экспорт со всеми позициями (номенклатура каждой позиции подтянута сразу) — для предпросмотра и скачивания. None, если не найден или уже мягко удалён."""
        result = await self.db.execute(
            select(Export)
            .where(Export.id == export_id, Export.is_active.is_(True))
            .options(
                selectinload(Export.user),
                selectinload(Export.items)
                .selectinload(ExportItem.stock_operation)
                .selectinload(StockOperation.nomenclature),
            )
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        *,
        user_id: int,
        operation_ids: list[int],
        invoice_number: Optional[str],
        contract_name: Optional[str],
        released_by: Optional[str],
        received_by: Optional[str],
    ) -> Export:
        export_row = Export(
            invoice_number=invoice_number,
            contract_name=contract_name,
            released_by=released_by,
            received_by=received_by,
            user_id=user_id,
        )
        self.db.add(export_row)
        await self.db.flush()
        self.db.add_all(
            ExportItem(export_id=export_row.id, stock_operation_id=op_id)
            for op_id in operation_ids
        )
        await self.db.commit()
        await self.db.refresh(export_row)
        return export_row

    async def deactivate(self, export_id: int) -> Optional[Export]:
        result = await self.db.execute(
            select(Export).where(Export.id == export_id, Export.is_active.is_(True))
        )
        export_row = result.scalar_one_or_none()
        if export_row is None:
            return None
        export_row.is_active = False
        await self.db.commit()
        return export_row
