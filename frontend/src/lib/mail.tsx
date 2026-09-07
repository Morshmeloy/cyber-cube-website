/**
 * Public entry point exposed by the WEB1 reverse proxy.
 *
 * Keep this URL relative: the browser reuses the current HTTPS origin, so the
 * link works in production without embedding a VPN address or environment-
 * specific hostname.
 */
export const MAIL_UI_URL = '/mail'

export const MAIL_REFRESH_INTERVAL_MS = 60_000

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
