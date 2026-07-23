from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete
from src.models.warehouse import WarehouseItem
from src.schemas.warehouse import WarehouseItemCreate, WarehouseItemUpdate
from typing import List, Optional

class WarehouseRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, item_data: WarehouseItemCreate, user_id: int) -> WarehouseItem:
        item = WarehouseItem(
            name=item_data.name,
            quantity=item_data.quantity,
            movement_type=item_data.movement_type,
            person=item_data.person,
            user_id=user_id,
        )
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def get_all(self, skip: int = 0, limit: int = 100) -> List[WarehouseItem]:
        result = await self.db.execute(
            select(WarehouseItem).order_by(WarehouseItem.date.desc()).offset(skip).limit(limit)
        )
        return result.scalars().all()

    async def get_by_id(self, item_id: int) -> Optional[WarehouseItem]:
        result = await self.db.execute(select(WarehouseItem).where(WarehouseItem.id == item_id))
        return result.scalar_one_or_none()

    async def update(self, item_id: int, update_data: WarehouseItemUpdate) -> Optional[WarehouseItem]:
        item = await self.get_by_id(item_id)
        if not item:
            return None
        # Обновляем только переданные поля
        for key, value in update_data.model_dump(exclude_unset=True).items():
            setattr(item, key, value)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def delete(self, item_id: int) -> bool:
        item = await self.get_by_id(item_id)
        if not item:
            return False
        await self.db.delete(item)
        await self.db.commit()
        return True

    # Дополнительный метод для получения агрегированных остатков
    async def get_aggregated_balances(self) -> dict:
        """
        Возвращает словарь {имя_товара: остаток} на основе всех записей.
        """
        items = await self.get_all(limit=1000)  # ограничим для производительности
        balances = {}
        for item in items:
            delta = item.quantity if item.movement_type == MovementType.IN else -item.quantity
            balances[item.name] = balances.get(item.name, 0) + delta
        # Убираем нулевые остатки
        return {name: qty for name, qty in balances.items() if qty != 0}