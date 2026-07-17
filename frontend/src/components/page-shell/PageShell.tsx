import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { PageRenderer } from './PageRenderer.tsx'
import { useNetworkCanvas } from '@/hooks/useNetworkCanvas.tsx'
import type { AudioEngine } from '@/types/audio.tsx'
import type { PageContent, PageNavigationTarget } from '@/types/page-content.tsx'

export interface PageShellTarget {
  color: string
  content: PageContent
  /** Переопределяет действие крестика для этого показа (например, разделы личного
   * кабинета возвращают не к кубу, а на дашборд). См. PlasmaShowOptions в старой версии. */
  onClose?: () => void
}

interface PageShellProps {
  /** null — панель закрыта. */
  target: PageShellTarget | null
  navigateTo: (target: PageNavigationTarget) => void
  audio: AudioEngine
  /** Дефолтное закрытие (крестик без onClose на target) — обычно «вернуться к кубу». */
  onDefaultClose: () => void
}

const EXPAND_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>'
const COLLAPSE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>'

const FULLSCREEN_PREF_KEY = 'd4_plasma_fullscreen'
function getFullscreenPref(): boolean {
  return localStorage.getItem(FULLSCREEN_PREF_KEY) === '1'
}
function setFullscreenPref(value: boolean): void {
  localStorage.setItem(FULLSCREEN_PREF_KEY, value ? '1' : '0')
}

/**
 * React-порт navigation/plasma.ts — панель страницы, открывающаяся вместо куба. Логика
 * (полноэкранный режим переживает закрытие, кросс-фейд контента при переключении страницы
 * без закрытия панели, Escape сворачивает полноэкранный режим) не менялась, только
 * состояние теперь React (isActive/isFullscreen/displayed), а не императивные classList/style.
 * Стили — Tailwind вместо plasma-screen.css; --plasma-color прокидывается инлайн-стилем,
 * произвольные Tailwind-значения читают его через var().
 */
export function PageShell({ target, navigateTo, audio, onDefaultClose }: PageShellProps) {
  const [isActive, setIsActive] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(getFullscreenPref)
  const [displayed, setDisplayed] = useState<PageShellTarget | null>(null)
  const [contentVisible, setContentVisible] = useState(true)

  const networkCanvasRef = useRef<HTMLCanvasElement>(null)
  const contentViewportRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(false)

  // Открытие/закрытие/переключение контента — тот же сценарий, что был в plasma.ts::show()/hide().
  useEffect(() => {
    if (target) {
      audio.playPlasmaOpen()
      if (!wasOpenRef.current) {
        // Открытие из закрытого состояния.
        wasOpenRef.current = true
        setDisplayed(target)
        setContentVisible(true)
        contentViewportRef.current?.scrollTo({ top: 0 })
        // Кадр на то, чтобы браузер закоммитил "закрытое" состояние перед транзишном в открытое.
        requestAnimationFrame(() => setIsActive(true))
      } else {
        // Панель уже открыта — короткий кросс-фейд контента без пересборки панели.
        setContentVisible(false)
        const timer = setTimeout(() => {
          setDisplayed(target)
          contentViewportRef.current?.scrollTo({ top: 0 })
          setContentVisible(true)
        }, 180)
        return () => clearTimeout(timer)
      }
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false
      audio.playPlasmaClose()
      setIsActive(false)
      // Полноэкранное состояние намеренно не сбрасывается — сохраняется до следующего открытия.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- audio стабилен на весь жизненный цикл
  }, [target])

  useNetworkCanvas(networkCanvasRef)

  useEffect(() => {
    function onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape' && isFullscreen) toggleFullscreen(false)
    }
    document.addEventListener('keydown', onKeydown)
    return () => document.removeEventListener('keydown', onKeydown)
  }, [isFullscreen])

  function toggleFullscreen(value: boolean): void {
    setIsFullscreen(value)
    setFullscreenPref(value)
  }

  function handleClose(): void {
    if (target?.onClose) target.onClose()
    else onDefaultClose()
  }

  if (!displayed) return null

  const rootStyle = { '--plasma-color': displayed.color } as CSSProperties

  return (
    <div
      style={rootStyle}
      data-plasma-panel
      className={`relative z-11 mt-[clamp(8px,1.2vh,16px)] w-[min(calc(100vw-32px),1600px)] overflow-hidden rounded-xl border transition-[height,transform,filter,opacity,border-color,box-shadow] duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isActive
          ? 'h-[min(78vh,900px)] scale-100 translate-y-0 border-[var(--plasma-color)] opacity-100 shadow-[0_0_12px_var(--plasma-color),0_0_30px_color-mix(in_srgb,var(--plasma-color)_50%,transparent),inset_0_0_20px_rgba(0,0,0,0.6)] blur-none'
          : 'h-0 scale-[0.92] translate-y-[28px] border-transparent opacity-0 blur-[6px]'
      } ${isFullscreen && isActive ? 'fixed inset-0 z-[400] h-screen w-screen max-w-none rounded-none' : ''}`}
    >
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{ background: 'linear-gradient(160deg, rgba(6, 8, 20, 0.97) 0%, rgba(4, 4, 12, 0.97) 100%)' }}
      />

      <div className="absolute inset-0 animate-[plasmaShift_6s_ease-in-out_infinite_alternate] opacity-12" style={{ background: 'radial-gradient(ellipse at 50% 50%, var(--plasma-color) 0%, #050510 80%)' }} />
      <canvas ref={networkCanvasRef} className="absolute inset-0 z-[1] opacity-35" />
      <div
        className="absolute inset-0 z-[2]"
        style={{ background: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)' }}
      />

      <div
        ref={contentViewportRef}
        className="absolute inset-0 z-[3] overflow-x-hidden overflow-y-auto px-[clamp(16px,4vw,48px)] pt-11 pb-8"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--plasma-color) rgba(5, 5, 16, 0.4)' }}
      >
        <div className={`transition-opacity duration-[180ms] ease-in-out ${contentVisible ? 'opacity-100' : 'opacity-0'}`}>
          <PageRenderer content={displayed.content} navigateTo={navigateTo} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[4] h-[40%] rounded-t-xl" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.06), transparent)' }} />

      {isActive && (
        <>
          <button
            type="button"
            aria-label="На весь экран"
            onClick={() => toggleFullscreen(!isFullscreen)}
            dangerouslySetInnerHTML={{ __html: isFullscreen ? COLLAPSE_ICON : EXPAND_ICON }}
            className={`absolute top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--plasma-color)] bg-[#050510d9] p-2 text-[var(--plasma-color)] shadow-[0_0_12px_color-mix(in_srgb,var(--plasma-color)_40%,transparent)] transition-all hover:scale-[1.12] hover:shadow-[0_0_20px_color-mix(in_srgb,var(--plasma-color)_60%,transparent)] ${
              isFullscreen ? 'left-3' : 'right-14'
            }`}
          />
          <button
            type="button"
            aria-label="Закрыть"
            onClick={handleClose}
            className={`absolute top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--plasma-color)] bg-[#050510d9] text-[22px] leading-none font-light text-[var(--plasma-color)] shadow-[0_0_12px_color-mix(in_srgb,var(--plasma-color)_40%,transparent)] transition-all hover:scale-[1.12] hover:shadow-[0_0_20px_color-mix(in_srgb,var(--plasma-color)_60%,transparent)] ${
              isFullscreen ? 'left-14' : 'right-3'
            }`}
          >
            &times;
          </button>
        </>
      )}
    </div>
  )
}
