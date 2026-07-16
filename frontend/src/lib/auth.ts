import axios from 'axios'

export interface User {
  username: string
  role: 'engineer' | 'accountant' | 'admin' | 'employee'
  token: string
}

const STORAGE_KEY = 'd4_user'

/** Бэкенд авторизации (backend/main.py, FastAPI) — поднимается отдельно на порту 9000. */
const LOGIN_API_URL = 'http://localhost:9000/api/login'

export type LoginError = 'invalid-credentials' | 'server-unreachable'
export type LoginResult = { user: User } | { error: LoginError }

/** Проверяет логин/пароль на бэкенде (POST /api/login) и, при успехе, сохраняет
 * сессию `{username, role, token}` в localStorage. Бэкенд должен быть запущен
 * (см. backend/main.py) — иначе вернётся 'server-unreachable'. */
export async function login(username: string, password: string): Promise<LoginResult> {
  try {
    const response = await axios.post<{ token: string; role: User['role'] }>(LOGIN_API_URL, { username, password })
    const user: User = { username, role: response.data.role, token: response.data.token }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    return { user }
  } catch (error) {
    // response есть — бэкенд ответил ошибкой (неверный логин/пароль); response нет — сеть/сервер недоступны.
    if (axios.isAxiosError(error) && error.response) return { error: 'invalid-credentials' }
    return { error: 'server-unreachable' }
  }
}

export function logout(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem(STORAGE_KEY)
}

export function getUser(): User | null {
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) return null
  try {
    return JSON.parse(data) as User
  } catch {
    return null
  }
}
