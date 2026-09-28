import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

const API_BASE_URL = '/api'

/**
 * Короткоживущий access-токен живёт только в памяти вкладки. Долгоживущий
 * refresh-токен браузер хранит в Secure HttpOnly cookie: JavaScript не может его
 * прочитать или случайно записать в localStorage. После обновления/открытия сайта
 * приложение восстанавливает access-токен через /auth/refresh.
 */
let accessToken: string | null = null

type SessionExpiredHandler = () => void
let onSessionExpired: SessionExpiredHandler | null = null

/** Вызывается, когда сессию не удалось продлить (refresh-токен истёк/невалиден) —
 * подписчик (AppRoot) должен разлогинить пользователя и показать форму входа. */
export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  onSessionExpired = handler
}

export function setAccessTokenFromResponse(tokens: { access_token: string }): void {
  accessToken = tokens.access_token
}

function setAccessToken(token: string): void {
  accessToken = token
}

export function clearTokens(): void {
  accessToken = null
}

export function getAccessToken(): string | null {
  return accessToken
}

function withAuthorization(init: RequestInit, token: string | null): RequestInit {
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return { ...init, headers }
}

export const apiClient = axios.create({ baseURL: API_BASE_URL, withCredentials: true })

// У этих путей ещё нет (или не нужен) access-токен: /login и /register вызываются
// анонимно, /refresh и /logout аутентифицируются HttpOnly cookie.
const AUTH_FREE_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']

apiClient.interceptors.request.use((config) => {
  const isAuthFree = AUTH_FREE_PATHS.some((path) => config.url?.includes(path))
  if (accessToken && !isAuthFree) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

// Несколько запросов, упавших с 401 одновременно, не должны каждый запускать свой
// /auth/refresh — все они переиспользуют один и тот же промис обновления токена.
let refreshPromise: Promise<string> | null = null

export async function refreshAccessToken(): Promise<string> {
  const response = await axios.post<{ access_token: string }>(
    `${API_BASE_URL}/auth/refresh`,
    {},
    { withCredentials: true },
  )
  setAccessToken(response.data.access_token)
  return response.data.access_token
}

/** Авторизованный fetch для потоковых SSE-ответов Учителя. */
export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  let response = await fetch(input, { ...withAuthorization(init, accessToken), credentials: 'include' })
  if (response.status !== 401) return response
  try {
    refreshPromise ??= refreshAccessToken().finally(() => { refreshPromise = null })
    const token = await refreshPromise
    response = await fetch(input, { ...withAuthorization(init, token), credentials: 'include' })
    if (response.status === 401) {
      clearTokens()
      onSessionExpired?.()
    }
    return response
  } catch {
    clearTokens()
    onSessionExpired?.()
    return response
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableRequestConfig | undefined
    const isRefreshCall = original?.url?.includes('/auth/refresh')

    if (error.response?.status === 401 && original && !original._retry && !isRefreshCall) {
      original._retry = true
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null
        })
        const newAccessToken = await refreshPromise
        original.headers.set('Authorization', `Bearer ${newAccessToken}`)
        return await apiClient(original)
      } catch {
        clearTokens()
        onSessionExpired?.()
        return Promise.reject(error)
      }
    }

    if (error.response?.status === 401 && isRefreshCall) {
      clearTokens()
      onSessionExpired?.()
    }

    return Promise.reject(error)
  },
)
