from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from src.repositories.role_repository import RoleRepository
from src.repositories.user_repository import UserRepository
from src.repositories.audit_repository import AuditRepository
from src.schemas.role import RoleCreate, RoleUpdate, RoleResponse
from src.schemas.auth import UserCreate, UserUpdate, UserResponse
from src.core.security import get_password_hash
from src.models.user import User


class AdminService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.role_repo = RoleRepository(db)
        self.user_repo = UserRepository(db)
        self.audit_repo = AuditRepository(db)

    async def list_roles(self) -> list[RoleResponse]:
        roles = await self.role_repo.get_all()
        return [RoleResponse.model_validate(r) for r in roles]

    async def create_role(self, data: RoleCreate, current_user: User) -> RoleResponse:
        role = await self.role_repo.create(
            name=data.name,
            can_view_warehouse=data.can_view_warehouse,
            can_manage_warehouse_operations=data.can_manage_warehouse_operations,
            can_sync_warehouse_1c=data.can_sync_warehouse_1c,
            can_manage_users=data.can_manage_users,
            can_manage_roles=data.can_manage_roles,
            can_view_all_documents=data.can_view_all_documents,
        )
        await self.audit_repo.log(
            user_id=current_user.id,
            action="role_created",
            entity_type="role",
            entity_id=role.id,
            details={"name": role.name},
        )
        return RoleResponse.model_validate(role)

    async def update_role(
        self, role_id: int, data: RoleUpdate, current_user: User
    ) -> RoleResponse:
        role = await self.role_repo.get_by_id(role_id)
        if not role:
            raise HTTPException(status_code=404, detail="Роль не найдена")
        if role.is_system:
            raise HTTPException(
                status_code=400, detail="Системную роль нельзя изменить"
            )
        updated = await self.role_repo.update(
            role,
            name=data.name,
            can_view_warehouse=data.can_view_warehouse,
            can_manage_warehouse_operations=data.can_manage_warehouse_operations,
            can_sync_warehouse_1c=data.can_sync_warehouse_1c,
            can_manage_users=data.can_manage_users,
            can_manage_roles=data.can_manage_roles,
            can_view_all_documents=data.can_view_all_documents,
        )
        await self.audit_repo.log(
            user_id=current_user.id,
            action="role_updated",
            entity_type="role",
            entity_id=role.id,
            details={"name": updated.name},
        )
        return RoleResponse.model_validate(updated)

    async def delete_role(self, role_id: int, current_user: User) -> None:
        role = await self.role_repo.get_by_id(role_id)
        if not role:
            raise HTTPException(status_code=404, detail="Роль не найдена")
        if role.is_system:
            raise HTTPException(status_code=400, detail="Системную роль нельзя удалить")
        if await self.role_repo.has_users(role_id):
            raise HTTPException(
                status_code=400,
                detail="Нельзя удалить роль, пока есть пользователи с этой ролью — сначала назначьте им другую роль",
            )
        await self.role_repo.delete(role)
        await self.audit_repo.log(
            user_id=current_user.id,
            action="role_deleted",
            entity_type="role",
            entity_id=role_id,
            details={"name": role.name},
        )

    async def list_users(self) -> list[UserResponse]:
        users = await self.user_repo.get_all_users()
        return [UserResponse.model_validate(u) for u in users]

    async def create_user(self, data: UserCreate, current_user: User) -> UserResponse:
        if await self.user_repo.get_user_by_username(data.username):
            raise HTTPException(status_code=400, detail="Такой логин уже занят")
        if await self.user_repo.get_user_by_email(data.email):
            raise HTTPException(
                status_code=400, detail="Такой email уже зарегистрирован"
            )
        role = await self.role_repo.get_by_id(data.role_id)
        if not role:
            raise HTTPException(status_code=404, detail="Роль не найдена")
        hashed = get_password_hash(data.password)
        user = await self.user_repo.create_user(data, hashed)
        user = await self.user_repo.get_user_by_id(user.id)
        await self.audit_repo.log(
            user_id=current_user.id,
            action="user_created",
            entity_type="user",
            entity_id=user.id,
            details={"username": user.username, "role": role.name},
        )
        return UserResponse.model_validate(user)

    async def update_user(
        self, user_id: int, data: UserUpdate, current_user: User
    ) -> UserResponse:
        user = await self.user_repo.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        if user.role.is_system and not current_user.role.is_system:
            raise HTTPException(
                status_code=403,
                detail="Только администратор может изменять администратора",
            )
        if data.role_id is not None:
            role = await self.role_repo.get_by_id(data.role_id)
            if not role:
                raise HTTPException(status_code=404, detail="Роль не найдена")
        updated = await self.user_repo.update_user(
            user, role_id=data.role_id, is_active=data.is_active
        )
        await self.audit_repo.log(
            user_id=current_user.id,
            action="user_updated",
            entity_type="user",
            entity_id=user_id,
            details={"role_id": data.role_id, "is_active": data.is_active},
        )
        return UserResponse.model_validate(updated)
