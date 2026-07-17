import { ChevronDown } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.tsx'
import { getUser, logout } from '@/lib/auth.tsx'
import { ROLE_LABELS } from '@/data/navigation/private.tsx'
import { LOGO_MARK_IMAGE_PATH, SITE_NAME } from '@/data/site/site.tsx'
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
  if (!user) return null

  return (
    <div className="fixed top-[clamp(10px,2vh,20px)] right-[clamp(10px,2vw,24px)] z-[600]">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-3.5 rounded-full border border-cyan-400/35 bg-[#050510bf] py-2.5 pr-4.5 pl-2.5 font-heading text-[#e8f8ff] shadow-[0_0_14px_rgba(0,255,255,0.15)] backdrop-blur-md transition-shadow hover:border-cyan-400/70 hover:shadow-[0_0_20px_rgba(0,255,255,0.3)]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-cyan-400/50 shadow-[0_0_10px_rgba(0,255,255,0.35)]" style={{ background: 'radial-gradient(circle at 30% 30%, rgba(0, 255, 255, 0.35), rgba(0, 0, 0, 0.6))' }}>
              <img src={LOGO_MARK_IMAGE_PATH} alt={SITE_NAME} className="h-[70%] w-[70%] object-contain drop-shadow-[0_0_4px_rgba(0,255,255,0.6)]" />
            </span>
            <span className="hidden flex-col items-start text-left leading-tight sm:flex">
              <span className="max-w-[210px] overflow-hidden text-lg font-bold text-ellipsis whitespace-nowrap">{user.username}</span>
              <span className="text-base text-[#e8f8ff]/55">{ROLE_LABELS[user.role]}</span>
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
