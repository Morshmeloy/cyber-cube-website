import { useEffect, useState } from 'react'
import { fetchMe, getUser } from '@/lib/auth.tsx'
import { DASHBOARD_NAV_CARDS, PRIVATE_PAGE_COLORS } from '@/data/navigation/private.tsx'
import type { CSSProperties } from 'react'
import type { PageNavigationTarget } from '@/types/page-content.tsx'

interface DashboardPageProps {
  navigateTo: (target: PageNavigationTarget) => void
}

/** React-порт settings/navigation/pages/dashboard.ts — приветствие + ряд разворачивающихся
 * по наведению карточек-разделов («flex cards»): наведение/фокус расширяет карточку,
 * клик — переходит в раздел (в т.ч. на тач, где ховера нет). */
export function DashboardPage({ navigateTo }: DashboardPageProps) {
  // Сразу — закэшированный профиль (без задержки на первый рендер), затем обновляем
  // его актуальными данными с GET /api/auth/me (роль/full_name могли измениться).
  const [user, setUser] = useState(() => getUser())
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    fetchMe().then((freshUser) => {
      if (freshUser) setUser(freshUser)
    })
  }, [])

  return (
    <div>
      <div className="mb-6.5 flex items-start justify-between gap-4 border-b border-[#e8f8ff]/12 pb-5">
        <div>
          <p className="mb-1.5 text-xs font-bold tracking-[0.16em] text-[var(--plasma-color)] uppercase [text-shadow:0_0_6px_color-mix(in_srgb,var(--plasma-color)_60%,transparent)]">
            Личный кабинет
          </p>
          <h2 className="mb-1 text-[clamp(20px,3vw,28px)] font-extrabold text-[var(--plasma-color)] [text-shadow:0_0_8px_color-mix(in_srgb,var(--plasma-color)_40%,transparent)]">
            Добро пожаловать, {user?.fullName || user?.username || 'пользователь'}
          </h2>
          <p className="text-[13px] text-[#e8f8ff]/60">{user?.role.name ?? ''}</p>
        </div>
      </div>

      <div className="flex h-[clamp(260px,40vh,340px)] gap-2.5 max-sm:h-auto max-sm:flex-col" role="list">
        {DASHBOARD_NAV_CARDS.map((card, index) => {
          const isActive = index === activeIndex
          return (
            <button
              key={card.key}
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onClick={() => navigateTo({ private: card.key })}
              style={{ '--card-color': PRIVATE_PAGE_COLORS[card.key], flex: isActive ? '3.4' : '1' } as CSSProperties}
              className={`relative min-w-0 overflow-hidden rounded-2xl border-none p-0 transition-[flex,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] max-sm:!flex-none max-sm:h-16 ${
                isActive
                  ? 'shadow-[inset_0_0_0_1px_var(--card-color),0_0_22px_color-mix(in_srgb,var(--card-color)_45%,transparent)]'
                  : 'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--card-color)_45%,transparent)]'
              }`}
            >
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, color-mix(in srgb, var(--card-color) 55%, black) 0%, color-mix(in srgb, var(--card-color) 22%, black) 100%)' }}
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                dangerouslySetInnerHTML={{ __html: card.icon }}
                style={{ color: 'color-mix(in srgb, var(--card-color) 70%, white)', filter: 'drop-shadow(0 0 6px color-mix(in srgb, var(--card-color) 70%, transparent))' }}
                className={`absolute left-1/2 h-7.5 w-7.5 -translate-x-1/2 transition-[top,transform] duration-400 ease-in-out max-sm:top-1/2! max-sm:left-5! max-sm:-translate-y-1/2! max-sm:translate-x-0! ${
                  isActive ? 'top-7 -translate-y-0' : 'top-1/2 -translate-y-1/2'
                }`}
              />
              <div
                className={`absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4 text-left transition-[opacity,transform] duration-300 ease-in-out max-sm:!static max-sm:!translate-y-0 max-sm:!justify-center max-sm:!p-2 max-sm:!pl-14 max-sm:!opacity-100 ${
                  isActive ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0'
                }`}
              >
                <span className="text-[15px] font-extrabold whitespace-nowrap text-white">{card.title}</span>
                <span className="text-xs leading-snug text-white/75">{card.desc}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
