import { useEffect, useState } from 'react'
import { ChevronDown, Mail } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.tsx'
import { getUser, logout } from '@/lib/auth.tsx'
import { LOGO_MARK_IMAGE_PATH, SITE_NAME } from '@/data/site/site.tsx'
import { MAIL_REFRESH_INTERVAL_MS, MAIL_UI_URL, resolveMailboxAddress, sumUnreadMail } from '@/lib/mail.tsx'
import type { PageNavigationTarget } from '@/types/page-content.tsx'

interface UserMenuProps {
  /** Перерисовывается родителем при каждой навигации — состояние входа могло измениться. */
  user: ReturnType<typeof getUser>
  navigateTo: (target: PageNavigationTarget) => void
  onLoggedOut: () => void
}

/** React-порт navigation/user-menu.ts — виджет профиля в правом верхнем углу, вне панели
 * страницы, виден поверх куба и любой открытой страницы. Пусто, пока пользователь не вошёл. */
export function UserMenu({ user, navigateTo, onLoggedOut }: UserMenuProps) {
  const [unreadMailCount, setUnreadMailCount] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return

    const mailboxAddress = resolveMailboxAddress(user.username, user.email)
    if (!mailboxAddress) return

    const mailboxPath = encodeURIComponent(mailboxAddress)
    let disposed = false
    let activeController: AbortController | null = null

    async function refreshUnreadCount(): Promise<void> {
      activeController?.abort()
      const controller = new AbortController()
      activeController = controller

      try {
        const response = await fetch(`/SOGo/so/${mailboxPath}/Mail/unseenCount`, {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          signal: controller.signal,
        })

        if (!response.ok) throw new Error(`SOGo unseenCount returned HTTP ${response.status}`)

        const count = sumUnreadMail(await response.json())
        if (count === null) throw new Error('SOGo unseenCount returned an unexpected response')
        if (!disposed) setUnreadMailCount(count)
      } catch (error) {
        if (!disposed && !(error instanceof DOMException && error.name === 'AbortError')) {
          // A missing Mailcow session is normal before the first mail login. The
          // envelope must remain usable, so the optional badge simply disappears.
          setUnreadMailCount(null)
        }
      }
    }

    function refreshWhenVisible(): void {
      if (document.visibilityState === 'visible') void refreshUnreadCount()
    }

    void refreshUnreadCount()
    const timer = window.setInterval(refreshUnreadCount, MAIL_REFRESH_INTERVAL_MS)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      disposed = true
      activeController?.abort()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [user])

  if (!user) return null

  const visibleUnreadCount = unreadMailCount && unreadMailCount > 0 ? Math.min(unreadMailCount, 99) : null

  return (
    <div className="fixed top-[clamp(10px,2vh,20px)] right-[clamp(10px,2vw,24px)] z-[600] flex items-center gap-2.5">
      <a
        href={MAIL_UI_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Открыть рабочую почту"
        title="Открыть рабочую почту в новой вкладке"
        className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-cyan-400/35 bg-[#050510bf] text-[#e8f8ff] shadow-[0_0_14px_rgba(0,255,255,0.15)] backdrop-blur-md transition-[border-color,color,box-shadow,transform] hover:scale-105 hover:border-cyan-400/75 hover:text-cyan-200 hover:shadow-[0_0_22px_rgba(0,255,255,0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
      >
        <Mail aria-hidden="true" className="h-6 w-6" strokeWidth={1.8} />
        {visibleUnreadCount !== null && (
          <span
            aria-label={`Непрочитанных писем: ${unreadMailCount}`}
            className="absolute -top-1 -right-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border border-[#050510] bg-[#ff3b6b] px-1 text-[10px] leading-none font-bold text-white shadow-[0_0_10px_rgba(255,59,107,0.75)]"
          >
            {unreadMailCount && unreadMailCount > 99 ? '99+' : visibleUnreadCount}
          </span>
        )}
      </a>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-3.5 rounded-full border border-cyan-400/35 bg-[#050510bf] py-2.5 pr-4.5 pl-2.5 font-heading text-[#e8f8ff] shadow-[0_0_14px_rgba(0,255,255,0.15)] backdrop-blur-md transition-shadow hover:border-cyan-400/70 hover:shadow-[0_0_20px_rgba(0,255,255,0.3)]"
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-cyan-400/50 shadow-[0_0_10px_rgba(0,255,255,0.35)]"
              style={{ background: 'radial-gradient(circle at 30% 30%, rgba(0, 255, 255, 0.35), rgba(0, 0, 0, 0.6))' }}
            >
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
