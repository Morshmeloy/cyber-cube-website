import { getUser } from './auth.ts'

function getStorageKey(prefix: string): string {
  const user = getUser()
  if (!user) throw new Error('Пользователь не авторизован')
  return `d4_${prefix}_${user.username}`
}

export function getData<T>(prefix: string, defaultData: T): T {
  const key = getStorageKey(prefix)
  const raw = localStorage.getItem(key)
  if (!raw) return defaultData
  try {
    return JSON.parse(raw) as T
  } catch {
    return defaultData
  }
}

export function setData<T>(prefix: string, data: T): void {
  const key = getStorageKey(prefix)
  localStorage.setItem(key, JSON.stringify(data))
}
