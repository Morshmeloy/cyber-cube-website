import axios from 'axios'
import { apiClient, setAccessTokenFromResponse, clearTokens, getAccessToken, refreshAccessToken } from './http-client.tsx'

export interface Role {
  id: number
  name: string
  isSystem: boolean
  canViewWarehouse: boolean
  canManageWarehouseOperations: boolean
  canSyncWarehouse1c: boolean
  canManageUsers: boolean
  canManageRoles: boolean
  canViewAllDocuments: boolean
  canViewAllExpenses: boolean
}

export interface User {
  id: number
  username: string
  email: string
  role: Role
  fullName: string | null
  isActive: boolean
}

export interface RoleDto {
  id: number
  name: string
  is_system: boolean
  can_view_warehouse: boolean
  can_manage_warehouse_operations: boolean
  can_sync_warehouse_1c: boolean
  can_manage_users: boolean
  can_manage_roles: boolean
  can_view_all_documents: boolean
  can_view_all_expenses: boolean
}

interface UserResponseDto {
  id: number
  username: string
  email: string
  role: RoleDto
  full_name: string | null
  is_active: boolean
}

const USER_CACHE_KEY = 'd4_user'

export function mapRole(dto: RoleDto): Role {
  return {
    id: dto.id,
    name: dto.name,
    isSystem: dto.is_system,
    canViewWarehouse: dto.can_view_warehouse,
    canManageWarehouseOperations: dto.can_manage_warehouse_operations,
    canSyncWarehouse1c: dto.can_sync_warehouse_1c,
    canManageUsers: dto.can_manage_users,
    canManageRoles: dto.can_manage_roles,
    canViewAllDocuments: dto.can_view_all_documents,
    canViewAllExpenses: dto.can_view_all_expenses,
  }
}

function mapUser(dto: UserResponseDto): User {
  return { id: dto.id, username: dto.username, email: dto.email, role: mapRole(dto.role), fullName: dto.full_name, isActive: dto.is_active }
}

function cacheUser(user: User): void {
  localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user))
}

/** Запрашивает канонический профиль текущего пользователя (GET /api/auth/me) и
 * обновляет кеш в localStorage — источник данных для дашборда и виджета профиля. */
export async function fetchMe(): Promise<User | null> {
  try {
    const response = await apiClient.get<UserResponseDto>('/auth/me')
    const user = mapUser(response.data)
    cacheUser(user)
    return user
  } catch {
    return null
  }
}

export type LoginError = 'invalid-credentials' | 'server-unreachable'
export type LoginResult = { user: User } | { error: LoginError }

/** Логин через POST /api/auth/login: сохраняет access/refresh-токены (см.
 * lib/http-client.ts), затем сразу запрашивает /api/auth/me за полным профилем —
 * ответ /login содержит только role, без id/email/full_name. */
export async function login(username: string, password: string, rememberMe = true): Promise<LoginResult> {
  try {
    const response = await apiClient.post<{ access_token: string; role: string }>('/auth/login', {
      username,
      password,
      remember_me: rememberMe,
    })
    setAccessTokenFromResponse(response.data)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) return { error: 'invalid-credentials' }
    return { error: 'server-unreachable' }
  }

  const user = await fetchMe()
  if (!user) return { error: 'server-unreachable' }
  return { user }
}

export function logout(): void {
  // Оба endpoint идемпотентны: первый удаляет пропуск к почтовому шлюзу, второй
  // отзывает постоянную браузерную сессию и удаляет refresh-cookie.
  void apiClient.delete('/auth/mail-session').catch(() => undefined)
  void apiClient.post('/auth/logout').catch(() => undefined)
  clearTokens()
  localStorage.removeItem(USER_CACHE_KEY)
}

/** Восстанавливает вход из защищённой cookie после перезагрузки страницы или
 * повторного открытия браузера. Пароль пользователю вводить не требуется. */
export async function restoreSession(): Promise<User | null> {
  try {
    await refreshAccessToken()
    return await fetchMe()
  } catch {
    clearTokens()
    localStorage.removeItem(USER_CACHE_KEY)
    return null
  }
}

export function isAuthenticated(): boolean {
  return !!getAccessToken()
}

/** Синхронно читает последний закэшированный профиль (localStorage) — без сетевого
 * запроса, для мгновенного рендера при монтировании. Актуализируется fetchMe(). */
export function getUser(): User | null {
  const data = localStorage.getItem(USER_CACHE_KEY)
  if (!data) return null
  try {
    return JSON.parse(data) as User
  } catch {
    return null
  }
}
