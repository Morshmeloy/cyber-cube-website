import { apiClient } from './http-client.tsx'

/** Same-origin public entry point. Nginx admits it only with d4_mail_access. */
export const MAIL_UI_URL = '/mail'

export const MAIL_REFRESH_INTERVAL_MS = 60_000

let mailSessionPromise: Promise<void> | null = null

/**
 * Exchanges the site's Bearer authentication for a signed HttpOnly gateway
 * cookie. JavaScript can neither read nor forge the resulting cookie.
 */
export function ensureMailAccess(): Promise<void> {
  mailSessionPromise ??= apiClient
    .post('/auth/mail-session')
    .then(() => undefined)
    .finally(() => {
      mailSessionPromise = null
    })
  return mailSessionPromise
}

/** Open a tab synchronously (to satisfy popup blockers), then navigate only
 * after the server has issued the protected mail-gateway cookie. */
export async function openMailWindow(): Promise<void> {
  const popup = window.open('about:blank', '_blank')
  if (!popup) throw new Error('MAIL_POPUP_BLOCKED')

  popup.opener = null
  try {
    await ensureMailAccess()
    if (!popup.closed) popup.location.replace(MAIL_UI_URL)
  } catch (error) {
    popup.close()
    throw error
  }
}

export function resolveMailboxAddress(username: string, email?: string | null): string | null {
  const preferred = email?.trim() || username.trim()
  if (!preferred) return null
  return (preferred.includes('@') ? preferred : `${preferred}@d4tech.ru`).toLowerCase()
}

export function sumUnreadMail(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null

  let total = 0
  let foundCount = false

  for (const value of Object.values(payload as Record<string, unknown>)) {
    const count = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(count) || count < 0) continue
    total += Math.floor(count)
    foundCount = true
  }

  return foundCount ? total : null
}
