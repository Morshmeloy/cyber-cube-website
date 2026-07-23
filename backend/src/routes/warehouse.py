from fastapi import APIRouter, Depends
from src.core.dependencies import get_current_user
from src.models.user import User

router = APIRouter(prefix="/warehouse", tags=["warehouse"])

@router.get("/")
async def get_warehouse(current_user: User = Depends(get_current_user)):
    return {"message": f"Warehouse data for {current_user.username}"}