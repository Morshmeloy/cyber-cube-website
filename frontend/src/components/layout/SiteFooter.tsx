import type { CSSProperties } from 'react'
import { faceColors } from '@/data/navigation/faces.tsx'
import { FOOTER_TAGLINE, FOOTER_NAV_ITEMS, FOOTER_CONTACT_LINES, FOOTER_LEGAL_LINES, FOOTER_CREDIT_LINE } from '@/data/site/footer.tsx'
import { LOGO_MARK_IMAGE_PATH, SITE_NAME } from '@/data/site/site.tsx'
import type { PageNavigationTarget } from '@/types/page-content.tsx'

interface SiteFooterProps {
  navigateTo: (target: PageNavigationTarget) => void
}

/** React-порт navigation/footer.ts — общий футер сайта, виден и на кубе, и поверх любой
 * открытой страницы, ниже по прокрутке. Намеренно спокойнее неонового интерфейса куба
 * (обычный регистр, без свечения) — так он читается как обычный подвал сайта. */
export function SiteFooter({ navigateTo }: SiteFooterProps) {
  return (
    <footer className="relative z-5 w-full cursor-auto px-[clamp(20px,6vw,64px)] pt-[180px] pb-8 font-sans text-[#e0ffffd9]" style={{ background: 'linear-gradient(to bottom, transparent, #050510 140px)' }}>
      <div className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-10 border-b border-white/12 pb-7">
        <div>
          <img src={LOGO_MARK_IMAGE_PATH} alt={SITE_NAME} className="h-auto w-40" />
          <p className="mt-4 max-w-[32ch] text-[15px] leading-[1.6] text-[#e0ffff]/65">{FOOTER_TAGLINE}</p>
        </div>
        <div>
          <h3 className="mb-4 text-[17px] font-bold text-white/95">Навигация</h3>
          <nav className="flex flex-col gap-3" aria-label="Навигация по сайту">
            {FOOTER_NAV_ITEMS.map((item) => (
              <button
                key={item.face}
                type="button"
                onClick={() => navigateTo({ face: item.face })}
                style={{ '--nav-color': faceColors[item.face] } as CSSProperties}
                className="w-fit cursor-pointer text-left font-sans text-[15px] text-[#e0ffff]/75 transition-[color,text-shadow] hover:text-[var(--nav-color)] hover:[text-shadow:0_0_8px_var(--nav-color)]"
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div>
          <h3 className="mb-4 text-[17px] font-bold text-white/95">Контакты</h3>
          <div>
            {FOOTER_CONTACT_LINES.map((line) => (
              <p key={line.label} className="text-[15px] leading-[1.8] text-[#e0ffff]/80">
                <span className="text-[#e0ffff]/50">{line.label}: </span>
                {line.href ? (
                  <a href={line.href} className="text-inherit no-underline hover:text-cyan-300">
                    {line.value}
                  </a>
                ) : (
                  line.value
                )}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-5 max-w-[1200px] text-[13px] leading-[1.8] text-[#e0ffff]/45">
        {FOOTER_LEGAL_LINES.map((line, i) => {
          const className = line.emphasis ? 'text-[15px] font-bold text-white/90' : undefined
          if (line.openLegalPage) {
            return (
              <p key={i} className={className}>
                <button type="button" onClick={() => navigateTo({ legal: true })} className="font-semibold text-white/90 underline hover:text-cyan-300">
                  {line.text}
                </button>
              </p>
            )
          }
          if (line.href) {
            return (
              <p key={i} className={className}>
                <a href={line.href} target="_blank" rel="noopener" className="font-semibold text-white/90 underline hover:text-cyan-300">
                  {line.text}
                </a>
              </p>
            )
          }
          return (
            <p key={i} className={className}>
              {line.text}
            </p>
          )
        })}
      </div>

      <div className="mx-auto mt-2 max-w-[1200px] text-xs text-[#e0ffff]/35">{FOOTER_CREDIT_LINE}</div>
    </footer>
  )
}
