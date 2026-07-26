from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.repositories.warehouse_repository import WarehouseRepository
from src.schemas.warehouse import WarehouseItemCreate, WarehouseItemUpdate
from src.models.user import User, UserRole

class WarehouseService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = WarehouseRepository(db)

    async def add_item(self, item_data: WarehouseItemCreate, current_user: User):
        # Все авторизованные пользователи могут добавлять записи
        return await self.repo.create(item_data, current_user.id)

    async def get_all_items(self, current_user: User, skip: int = 0, limit: int = 100):
        # Все пользователи могут просматривать
        return await self.repo.get_all(skip, limit)

    async def get_balances(self, current_user: User):
        # Все пользователи могут видеть остатки
        return await self.repo.get_aggregated_balances()

    async def update_item(self, item_id: int, update_data: WarehouseItemUpdate, current_user: User):
        # Только администратор может редактировать записи
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Only admin can edit warehouse items")
        item = await self.repo.update(item_id, update_data)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        return item

    async def delete_item(self, item_id: int, current_user: User):
        # Только администратор может удалять записи
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Only admin can delete warehouse items")
        deleted = await self.repo.delete(item_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Item not found")
        return {"message": "Item deleted successfully"}