import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

const API_BASE_URL = 'http://localhost:8000/api'

const ACCESS_TOKEN_KEY = 'd4_access_token'
const REFRESH_TOKEN_KEY = 'd4_refresh_token'

/**
 * ВНИМАНИЕ (риск для продакшена): access/refresh-токены хранятся в localStorage —
 * он доступен любому JS на странице, включая внедрённый через XSS. Для MVP это
 * осознанно допустимо (см. задачу), но перед продакшеном токены должны переехать
 * в HttpOnly-cookie, которую выставляет и читает только сервер, а JS к ней вообще
 * не имеет доступа — тогда весь код хранения токенов ниже станет не нужен.
 * Основной источник истины — переменные в памяti (accessToken/refreshToken),
 * localStorage — только для переживания перезагрузки страницы.
 */
let accessToken: string | null = localStorage.getItem(ACCESS_TOKEN_KEY)
let refreshToken: string | null = localStorage.getItem(REFRESH_TOKEN_KEY)

type SessionExpiredHandler = () => void
let onSessionExpired: SessionExpiredHandler | null = null

/** Вызывается, когда сессию не удалось продлить (refresh-токен истёк/невалиден) —
 * подписчик (AppRoot) должен разлогинить пользователя и показать форму входа. */
export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  onSessionExpired = handler
}

export function setTokens(tokens: { access_token: string; refresh_token: string }): void {
  accessToken = tokens.access_token
  refreshToken = tokens.refresh_token
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token)
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)
}

function setAccessToken(token: string): void {
  accessToken = token
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function clearTokens(): void {
  accessToken = null
  refreshToken = null
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getAccessToken(): string | null {
  return accessToken
}

export const apiClient = axios.create({ baseURL: API_BASE_URL })

// У этих путей ещё нет (или не нужен) access-токен: /login и /register вызываются
// анонимно, /refresh аутентифицируется отдельным refresh-токеном в теле запроса,
// а не заголовком Authorization.
const AUTH_FREE_PATHS = ['/auth/login', '/auth/register', '/auth/refresh']

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

async function performRefresh(): Promise<string> {
  if (!refreshToken) throw new Error('Нет refresh-токена')
  const response = await axios.post<{ access_token: string }>(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
  setAccessToken(response.data.access_token)
  return response.data.access_token
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableRequestConfig | undefined
    const isRefreshCall = original?.url?.includes('/auth/refresh')

    if (error.response?.status === 401 && original && !original._retry && !isRefreshCall && refreshToken) {
      original._retry = true
      try {
        refreshPromise ??= performRefresh().finally(() => {
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

    if (error.response?.status === 401 && (isRefreshCall || !refreshToken)) {
      clearTokens()
      onSessionExpired?.()
    }

    return Promise.reject(error)
  },
)
