import axios from 'axios'
import { apiClient, setTokens, clearTokens, getAccessToken } from './http-client.tsx'

export type UserRole = 'admin' | 'engineer' | 'accountant'

export interface User {
  id: number
  username: string
  email: string
  role: UserRole
  fullName: string | null
  isActive: boolean
}

interface UserResponseDto {
  id: number
  username: string
  email: string
  role: UserRole
  full_name: string | null
  is_active: boolean
}

const USER_CACHE_KEY = 'd4_user'

function mapUser(dto: UserResponseDto): User {
  return { id: dto.id, username: dto.username, email: dto.email, role: dto.role, fullName: dto.full_name, isActive: dto.is_active }
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
export async function login(username: string, password: string): Promise<LoginResult> {
  try {
    const response = await apiClient.post<{ access_token: string; refresh_token: string; role: UserRole }>('/auth/login', { username, password })
    setTokens(response.data)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) return { error: 'invalid-credentials' }
    return { error: 'server-unreachable' }
  }

  const user = await fetchMe()
  if (!user) return { error: 'server-unreachable' }
  return { user }
}

export interface RegisterData {
  username: string
  email: string
  password: string
  fullName?: string
  role: UserRole
}

export type RegisterError = 'username-taken' | 'email-taken' | 'invalid-data' | 'server-unreachable'
export type RegisterResult = { user: User } | { error: RegisterError }

/** Регистрация через POST /api/auth/register, затем автоматический вход тем же
 * логином/паролем — сам /register не выдаёт токены, только созданный профиль. */
export async function register(data: RegisterData): Promise<RegisterResult> {
  try {
    await apiClient.post('/auth/register', {
      username: data.username,
      email: data.email,
      password: data.password,
      full_name: data.fullName || null,
      role: data.role,
    })
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 400) {
      const detail = (error.response.data as { detail?: string } | undefined)?.detail ?? ''
      if (/username/i.test(detail)) return { error: 'username-taken' }
      if (/email/i.test(detail)) return { error: 'email-taken' }
      return { error: 'invalid-data' }
    }
    if (axios.isAxiosError(error) && error.response) return { error: 'invalid-data' }
    return { error: 'server-unreachable' }
  }

  const loginResult = await login(data.username, data.password)
  if ('user' in loginResult) return loginResult
  return { error: 'server-unreachable' }
}

export function logout(): void {
  clearTokens()
  localStorage.removeItem(USER_CACHE_KEY)
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
