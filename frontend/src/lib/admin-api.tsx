import { apiClient } from './http-client.tsx'
import { mapRole, type Role, type RoleDto } from './auth.tsx'

export interface AdminUser {
  id: number
  username: string
  email: string
  role: Role
  fullName: string | null
  isActive: boolean
}

interface AdminUserDto {
  id: number
  username: string
  email: string
  role: RoleDto
  full_name: string | null
  is_active: boolean
}

function mapAdminUser(dto: AdminUserDto): AdminUser {
  return { id: dto.id, username: dto.username, email: dto.email, role: mapRole(dto.role), fullName: dto.full_name, isActive: dto.is_active }
}

export interface RolePermissions {
  canViewWarehouse: boolean
  canManageWarehouseOperations: boolean
  canSyncWarehouse1c: boolean
  canManageUsers: boolean
  canManageRoles: boolean
  canViewAllDocuments: boolean
}

function permissionsToDto(permissions: RolePermissions) {
  return {
    can_view_warehouse: permissions.canViewWarehouse,
    can_manage_warehouse_operations: permissions.canManageWarehouseOperations,
    can_sync_warehouse_1c: permissions.canSyncWarehouse1c,
    can_manage_users: permissions.canManageUsers,
    can_manage_roles: permissions.canManageRoles,
    can_view_all_documents: permissions.canViewAllDocuments,
  }
}

export async function fetchRoles(): Promise<Role[]> {
  const response = await apiClient.get<RoleDto[]>('/admin/roles')
  return response.data.map(mapRole)
}

export async function createRole(name: string, permissions: RolePermissions): Promise<Role> {
  const response = await apiClient.post<RoleDto>('/admin/roles', { name, ...permissionsToDto(permissions) })
  return mapRole(response.data)
}

export async function updateRole(id: number, name: string, permissions: RolePermissions): Promise<Role> {
  const response = await apiClient.patch<RoleDto>(`/admin/roles/${id}`, { name, ...permissionsToDto(permissions) })
  return mapRole(response.data)
}

export async function deleteRole(id: number): Promise<void> {
  await apiClient.delete(`/admin/roles/${id}`)
}

export async function fetchUsers(): Promise<AdminUser[]> {
  const response = await apiClient.get<AdminUserDto[]>('/admin/users')
  return response.data.map(mapAdminUser)
}

export interface NewUserInput {
  username: string
  email: string
  password: string
  roleId: number
  fullName: string
}

export async function createUser(input: NewUserInput): Promise<AdminUser> {
  const response = await apiClient.post<AdminUserDto>('/admin/users', {
    username: input.username,
    email: input.email,
    password: input.password,
    role_id: input.roleId,
    full_name: input.fullName || null,
  })
  return mapAdminUser(response.data)
}

export async function updateUserRole(id: number, roleId: number): Promise<AdminUser> {
  const response = await apiClient.patch<AdminUserDto>(`/admin/users/${id}`, { role_id: roleId })
  return mapAdminUser(response.data)
}

export async function setUserActive(id: number, isActive: boolean): Promise<AdminUser> {
  const response = await apiClient.patch<AdminUserDto>(`/admin/users/${id}`, { is_active: isActive })
  return mapAdminUser(response.data)
}
