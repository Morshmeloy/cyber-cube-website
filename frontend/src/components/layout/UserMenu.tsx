import { useEffect, useState } from 'react'
import { ChevronDown, Mail } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.tsx'
import { getUser, logout } from '@/lib/auth.tsx'
import { LOGO_MARK_IMAGE_PATH, SITE_NAME } from '@/data/site/site.tsx'
import type { PageNavigationTarget } from '@/types/page-content.tsx'

interface UserMenuProps {
  /** Перерисовывается родителем при каждой навигации — состояние входа могло измениться. */
  user: ReturnType<typeof getUser>
  navigateTo: (target: PageNavigationTarget) => void
  onLoggedOut: () => void
  /** Реальное значение появится после подключения серверной проверки Mailcow. */
  unreadMailCount?: number
}

const MAIL_UI_URL = '/mail'
const MAIL_DOMAIN = 'd4tech.ru'
const MAIL_REFRESH_INTERVAL_MS = 60_000

/** React-порт navigation/user-menu.ts — виджет профиля в правом верхнем углу, вне панели
 * страницы, виден поверх куба и любой открытой страницы. Пусто, пока пользователь не вошёл. */
export function UserMenu({ user, navigateTo, onLoggedOut, unreadMailCount }: UserMenuProps) {
  const [fetchedUnreadMailCount, setFetchedUnreadMailCount] = useState<number | null>(null)

  const siteUsername = user?.username.trim() ?? ''
  const mailAccount = siteUsername
    ? (siteUsername.includes('@') ? siteUsername : `${siteUsername}@${MAIL_DOMAIN}`).toLowerCase()
    : null

  useEffect(() => {
    if (!mailAccount || unreadMailCount !== undefined) {
      setFetchedUnreadMailCount(null)
      return
    }

    let disposed = false
    let controller: AbortController | null = null

    const refreshUnreadCount = async () => {
      controller?.abort()
      controller = new AbortController()

      try {
        const mailAccountPath = encodeURIComponent(mailAccount).replace(/%40/gi, '@')
        const response = await fetch(
          `/SOGo/so/${mailAccountPath}/Mail/unseenCount`,
          {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store',
            headers: {
              Accept: 'application/json',
            },
            signal: controller.signal,
          },
        )

        if (!response.ok) {
          throw new Error(`SOGo unseenCount returned HTTP ${response.status}`)
        }

        const payload: unknown = await response.json()

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new Error('SOGo unseenCount returned an unexpected response')
        }

        const entries = Object.entries(payload as Record<string, unknown>)
        const inboxEntries = entries.filter(([key]) =>
          key.toLowerCase().endsWith('/folderinbox'),
        )
        const relevantEntries = inboxEntries.length > 0 ? inboxEntries : entries

        const count = relevantEntries.reduce((total, [, value]) => {
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            return total
          }

          return total + Math.max(0, Math.trunc(value))
        }, 0)

        if (!disposed) {
          setFetchedUnreadMailCount(count)
        }
      } catch (error) {
        const aborted =
          error instanceof DOMException && error.name === 'AbortError'

        if (!disposed && !aborted) {
          // Нет активной сессии SOGo — конверт остаётся без счётчика.
          setFetchedUnreadMailCount(null)
        }
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshUnreadCount()
      }
    }

    void refreshUnreadCount()

    const refreshTimer = window.setInterval(
      () => void refreshUnreadCount(),
      MAIL_REFRESH_INTERVAL_MS,
    )

    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      disposed = true
      controller?.abort()
      window.clearInterval(refreshTimer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [mailAccount, unreadMailCount])

  if (!user) return null

  const effectiveUnreadMailCount =
    unreadMailCount ?? fetchedUnreadMailCount

  const visibleUnreadCount =
    effectiveUnreadMailCount !== null && effectiveUnreadMailCount > 0
      ? Math.min(effectiveUnreadMailCount, 99)
      : null

  return (
    <div className="fixed top-[clamp(10px,2vh,20px)] right-[clamp(10px,2vw,24px)] z-[600] flex items-center gap-2.5">
      <a
        href={MAIL_UI_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Открыть рабочую почту"
        title="Открыть рабочую почту"
        className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-cyan-400/35 bg-[#050510bf] text-[#e8f8ff] shadow-[0_0_14px_rgba(0,255,255,0.15)] backdrop-blur-md transition-[border-color,color,box-shadow,transform] hover:scale-105 hover:border-cyan-400/75 hover:text-cyan-200 hover:shadow-[0_0_22px_rgba(0,255,255,0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
      >
        <Mail aria-hidden="true" className="h-6 w-6" strokeWidth={1.8} />
        {visibleUnreadCount !== null && (
          <span
            aria-label={`Непрочитанных писем: ${effectiveUnreadMailCount ?? 0}`}
            className="absolute -top-1 -right-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border border-[#050510] bg-[#ff3b6b] px-1 text-[10px] leading-none font-bold text-white shadow-[0_0_10px_rgba(255,59,107,0.75)]"
          >
            {effectiveUnreadMailCount !== null && effectiveUnreadMailCount > 99
              ? '99+'
              : visibleUnreadCount}
          </span>
        )}
      </a>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-3.5 rounded-full border border-cyan-400/35 bg-[#050510bf] py-2.5 pr-4.5 pl-2.5 font-heading text-[#e8f8ff] shadow-[0_0_14px_rgba(0,255,255,0.15)] backdrop-blur-md transition-shadow hover:border-cyan-400/70 hover:shadow-[0_0_20px_rgba(0,255,255,0.3)]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-cyan-400/50 shadow-[0_0_10px_rgba(0,255,255,0.35)]" style={{ background: 'radial-gradient(circle at 30% 30%, rgba(0, 255, 255, 0.35), rgba(0, 0, 0, 0.6))' }}>
              <img src={LOGO_MARK_IMAGE_PATH} alt={SITE_NAME} className="h-[70%] w-[70%] object-contain drop-shadow-[0_0_4px_rgba(0,255,255,0.6)]" />
            </span>
            <span className="hidden flex-col items-start text-left leading-tight sm:flex">
              <span className="max-w-[210px] overflow-hidden text-lg font-bold text-ellipsis whitespace-nowrap">{user.fullName || user.username}</span>
              <span className="text-base text-[#e8f8ff]/55">{user.role.name}</span>
            </span>
            <ChevronDown className="h-5.5 w-5.5 text-[#e8f8ff]/60 transition-transform data-[state=open]:rotate-180" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={12}
          className="min-w-[280px] rounded-2xl border border-cyan-400/30 bg-[#050510eb] p-2.5 font-heading text-[#e8f8ff] shadow-[0_8px_28px_rgba(0,0,0,0.5),0_0_20px_rgba(0,255,255,0.15)] backdrop-blur-lg"
        >
          <DropdownMenuItem
            onClick={() => navigateTo({ private: 'dashboard' })}
            className="cursor-pointer rounded-[11px] px-4.5 py-3.5 text-base text-[#e8f8ff] focus:bg-cyan-400/12 focus:text-[#e8f8ff]"
          >
            Личный кабинет
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              logout()
              onLoggedOut()
            }}
            className="cursor-pointer rounded-[11px] px-4.5 py-3.5 text-base text-[#ffb3b3] focus:bg-red-500/15 focus:text-[#ffb3b3]"
          >
            Выйти
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
