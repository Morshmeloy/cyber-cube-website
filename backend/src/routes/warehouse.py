from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from src.core.database import get_db
from src.core.dependencies import get_current_user
from src.models.user import User
from src.services.warehouse_service import WarehouseService
from src.schemas.warehouse import WarehouseItemCreate, WarehouseItemUpdate, WarehouseItemResponse

router = APIRouter(prefix="/warehouse", tags=["warehouse"])

@router.post("/", response_model=WarehouseItemResponse, status_code=201)
async def create_warehouse_item(
    item_data: WarehouseItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.add_item(item_data, current_user)

@router.get("/", response_model=List[WarehouseItemResponse])
async def get_warehouse_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.get_all_items(current_user, skip, limit)

@router.get("/balances")
async def get_balances(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.get_balances(current_user)

@router.put("/{item_id}", response_model=WarehouseItemResponse)
async def update_warehouse_item(
    item_id: int,
    update_data: WarehouseItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.update_item(item_id, update_data, current_user)

@router.delete("/{item_id}")
async def delete_warehouse_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = WarehouseService(db)
    return await service.delete_item(item_id, current_user)