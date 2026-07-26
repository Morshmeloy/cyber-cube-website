import type { UserRole } from './auth.tsx'

export interface AdminUser {
  id: number
  username: string
  email: string
  role: UserRole
  fullName: string | null
  isActive: boolean
}

/**
 * Заглушка API администрирования пользователей — реального бэкенд-эндпоинта пока нет
 * (backend/ умеет только регистрацию/логин/`/auth/me`, без списка/управления пользователями).
 * Данные живут в памяти модуля (сбрасываются при перезагрузке страницы), но каждая функция
 * оформлена как настоящий асинхронный запрос (искусственная задержка через setTimeout) —
 * чтобы UI (спиннеры, обработка ошибок) не пришлось переписывать, когда появится реальный
 * backend-эндпоинт: сигнатуры и форма ответа уже соответствуют будущему REST-контракту.
 */
const FAKE_LATENCY_MS = 500

let mockUsers: AdminUser[] = [
  { id: 1, username: 'admin', email: 'admin@d4tech.ru', role: 'admin', fullName: 'Администратор Системы', isActive: true },
  { id: 2, username: 'engineer1', email: 'engineer1@d4tech.ru', role: 'engineer', fullName: 'Иван Петров', isActive: true },
  { id: 3, username: 'accountant1', email: 'accountant1@d4tech.ru', role: 'accountant', fullName: 'Мария Сидорова', isActive: true },
  { id: 4, username: 'engineer2', email: 'engineer2@d4tech.ru', role: 'engineer', fullName: null, isActive: false },
]

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), FAKE_LATENCY_MS))
}

export function fetchAllUsers(): Promise<AdminUser[]> {
  return delay([...mockUsers])
}

export function updateUserRole(id: number, role: UserRole): Promise<AdminUser> {
  mockUsers = mockUsers.map((u) => (u.id === id ? { ...u, role } : u))
  const updated = mockUsers.find((u) => u.id === id)
  if (!updated) return Promise.reject(new Error('Пользователь не найден'))
  return delay(updated)
}

export function setUserActive(id: number, isActive: boolean): Promise<AdminUser> {
  mockUsers = mockUsers.map((u) => (u.id === id ? { ...u, isActive } : u))
  const updated = mockUsers.find((u) => u.id === id)
  if (!updated) return Promise.reject(new Error('Пользователь не найден'))
  return delay(updated)
}

export function deleteUser(id: number): Promise<void> {
  mockUsers = mockUsers.filter((u) => u.id !== id)
  return delay(undefined)
}
