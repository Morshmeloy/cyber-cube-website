from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import func
from typing import List, Optional
from src.models.warehouse import Nomenclature, StockOperation, OperationType


def normalize_name(name: str) -> str:
    return " ".join(name.strip().split()).lower()


class NomenclatureRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(self) -> List[Nomenclature]:
        result = await self.db.execute(select(Nomenclature).order_by(Nomenclature.name))
        return result.scalars().all()

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

    async def upsert_from_import(
        self, rows: list[tuple[str, float]]
    ) -> tuple[int, int]:
        """rows: [(название, количество), ...]. Возвращает (added, updated)."""
        added = 0
        updated = 0
        for name, quantity in rows:
            existing = await self.find_by_name(name)
            if existing:
                existing.base_quantity = quantity
                existing.base_synced_at = func.now()
                updated += 1
            else:
                self.db.add(
                    Nomenclature(
                        name=name.strip(),
                        base_quantity=quantity,
                        base_synced_at=func.now(),
                    )
                )
                added += 1
        await self.db.commit()
        return added, updated

    async def portal_quantity_map(self) -> dict[int, float]:
        """{nomenclature_id: сумма возвратов минус выдач через портал}"""
        result = await self.db.execute(select(StockOperation))
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
