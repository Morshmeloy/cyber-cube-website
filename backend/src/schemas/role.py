from pydantic import BaseModel
from typing import Optional


class RoleBase(BaseModel):
    can_view_warehouse: bool = False
    can_manage_warehouse_operations: bool = False
    can_sync_warehouse_1c: bool = False
    can_manage_users: bool = False
    can_manage_roles: bool = False


class RoleCreate(RoleBase):
    name: str


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    can_view_warehouse: Optional[bool] = None
    can_manage_warehouse_operations: Optional[bool] = None
    can_sync_warehouse_1c: Optional[bool] = None
    can_manage_users: Optional[bool] = None
    can_manage_roles: Optional[bool] = None


class RoleResponse(RoleBase):
    id: int
    name: str
    is_system: bool

    class Config:
        from_attributes = True
