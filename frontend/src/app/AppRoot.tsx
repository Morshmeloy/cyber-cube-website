import { useEffect, useRef, useState } from 'react'
import { createElement } from 'react'
import { Cube, type CubeHandle, type CubeVisualState } from '@/components/cube/Cube.tsx'
import { PageShell, type PageShellTarget } from '@/components/page-shell/PageShell.tsx'
import { SiteFooter } from '@/components/layout/SiteFooter.tsx'
import { UserMenu } from '@/components/layout/UserMenu.tsx'
import { BackgroundSlideshow } from '@/components/background/BackgroundSlideshow.tsx'
import { Rain } from '@/components/background/Rain.tsx'
import { useLumaKeyCutout } from '@/hooks/useLumaKeyCutout.tsx'
import { createAudioEngine } from '@/lib/audio-engine.tsx'
import { faceColors } from '@/data/navigation/faces.tsx'
import { pageContentByFace } from '@/data/navigation/pages/index.tsx'
import { legalPageColor, legalPageContent } from '@/data/navigation/pages/legal.tsx'
import { PRIVATE_PAGE_COLORS } from '@/data/navigation/private.tsx'
import { LOGO_IMAGE_PATH } from '@/data/site/site.tsx'
import { getUser, isAuthenticated, logout } from '@/lib/auth.tsx'
import { setSessionExpiredHandler } from '@/lib/http-client.tsx'
import { AuthScreen } from '@/components/auth/AuthScreen.tsx'
import { DashboardPage } from '@/components/private/DashboardPage.tsx'
import { DocsPage } from '@/components/private/DocsPage.tsx'
import { WarehousePage } from '@/components/private/WarehousePage.tsx'
import { FinancePage } from '@/components/private/FinancePage.tsx'
import { LearningQuiz } from '@/components/private/learning/LearningQuiz.tsx'
import type { PageContent, PageNavigationTarget, PrivatePageKey } from '@/types/page-content.tsx'

const audio = createAudioEngine()

/** Грань «Авторизация» — вход/регистрация (components/auth/AuthScreen.tsx) + биометрия-заглушка. */
function authPageContent(): PageContent {
  return {
    title: 'Вход в личный кабинет',
    blocks: [{ kind: 'component', render: ({ navigateTo }) => createElement(AuthScreen, { navigateTo }) }],
  }
}

function dashboardPageContent(): PageContent {
  return { title: '', blocks: [{ kind: 'component', render: ({ navigateTo }) => createElement(DashboardPage, { navigateTo }) }] }
}

const PRIVATE_PAGE_CONTENT: Record<Exclude<PrivatePageKey, 'dashboard'>, PageContent> = {
  learning: { title: 'Обучение: Компьютерные сети', blocks: [{ kind: 'component', render: () => createElement(LearningQuiz) }] },
  warehouse: { title: 'Складской учёт', blocks: [{ kind: 'component', render: () => createElement(WarehousePage) }] },
  docs: { title: 'Корпоративная документация', blocks: [{ kind: 'component', render: () => createElement(DocsPage) }] },
  finance: { title: 'Финансы (чеки и командировки)', blocks: [{ kind: 'component', render: () => createElement(FinancePage) }] },
}

/**
 * Корень приложения — React-порт navigation/navigation.ts::initSiteNavigation. Логика
 * (грань «Авторизация» ведёт на dashboard, если уже вошли; крестик в разделах кабинета
 * возвращает на dashboard, а не к кубу; вспышка/сжатие куба перед открытием панели) не
 * менялась — раньше это была прямая манипуляция DOM в plasma.ts/navigation.ts, теперь —
 * React state, разнесённое по компонентам-владельцам (Cube/PageShell/UserMenu/SiteFooter).
 */
export function AppRoot() {
  const [user, setUser] = useState(() => getUser())
  const [target, setTarget] = useState<PageShellTarget | null>(null)
  const [cubeVisual, setCubeVisual] = useState<CubeVisualState>('visible')
  const cubeHandleRef = useRef<CubeHandle>(null)
  const closeTimerRef = useRef<number | null>(null)

  const headerLogoCanvas = useRef<HTMLCanvasElement>(null)
  useLumaKeyCutout(headerLogoCanvas, LOGO_IMAGE_PATH, { sizeToImage: true })

  // Курсор "рука для перетаскивания" нужен только пока виден сам куб — на открытой
  // странице курсор должен быть обычным (см. body.plasma-open в прежней cube.css).
  useEffect(() => {
    document.body.style.cursor = target ? 'auto' : ''
  }, [target])

  // Если refresh-токен истёк/невалиден (см. lib/http-client.ts), сервер больше не
  // принимает access-токен ни на одном защищённом эндпоинте — разлогиниваем и
  // возвращаем на форму входа. Без deps-массива: navigateTo должен быть всегда
  // актуальным на момент реального вызова (а не тем, что был на старте).
  useEffect(() => {
    setSessionExpiredHandler(() => {
      logout()
      setUser(null)
      navigateTo({ face: 'front' })
    })
    return () => setSessionExpiredHandler(null)
  })

  function showPage(color: string, content: PageContent, onClose?: () => void): void {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (target === null) {
      // Открытие с нуля — вспышка/сжатие куба, затем открытие панели (было прямой
      // манипуляцией scene.style в plasma.ts::show()).
      cubeHandleRef.current?.pauseIdleBehaviour()
      setCubeVisual('closing')
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      closeTimerRef.current = window.setTimeout(() => {
        setCubeVisual('hidden')
        setTarget({ color, content, onClose })
      }, 450)
    } else {
      // Панель уже открыта — просто переключаем контент, PageShell сам сделает кросс-фейд.
      setTarget({ color, content, onClose })
    }
  }

  function hideToCube(): void {
    setTarget(null)
    setCubeVisual('visible')
    cubeHandleRef.current?.resetRotation()
    cubeHandleRef.current?.scheduleAutoRotation()
  }

  /** Общий диспетчер навигации — переход по грани/легальной странице/разделу кабинета,
   * используется кубом, футером, ссылками/кнопками внутри контента и виджетом профиля. */
  function navigateTo(navTarget: PageNavigationTarget): void {
    if ('legal' in navTarget) {
      showPage(legalPageColor, legalPageContent)
      setUser(getUser())
      return
    }
    if ('private' in navTarget) {
      if (!isAuthenticated()) {
        showPage(faceColors.front, authPageContent())
        setUser(getUser())
        return
      }
      if (navTarget.private === 'dashboard') {
        showPage(PRIVATE_PAGE_COLORS.dashboard, dashboardPageContent())
      } else {
        showPage(PRIVATE_PAGE_COLORS[navTarget.private], PRIVATE_PAGE_CONTENT[navTarget.private], () => navigateTo({ private: 'dashboard' }))
      }
      setUser(getUser())
      return
    }
    if (navTarget.face === 'front' && isAuthenticated()) {
      showPage(PRIVATE_PAGE_COLORS.dashboard, dashboardPageContent())
      setUser(getUser())
      return
    }
    showPage(faceColors[navTarget.face], navTarget.face === 'front' ? authPageContent() : pageContentByFace[navTarget.face as Exclude<typeof navTarget.face, 'front'>])
    setUser(getUser())
  }

  return (
    <>
      <BackgroundSlideshow />
      <Rain />

      <UserMenu user={user} navigateTo={navigateTo} onLoggedOut={() => navigateTo({ face: 'front' })} />

      <div className="relative flex min-h-screen w-full flex-col items-center justify-start gap-[1vh] pt-[1vh]">
        <h1
          data-text="Д4 Технологии"
          // pointer-events-none + select-none: чисто декоративный заголовок визуально
          // перекрывается кубом (z-[100] выше z-10 куба) — без этого драг мышью,
          // начатый на буквах заголовка, запускал нативное выделение/перетаскивание
          // текста браузером вместо вращения куба под ним.
          className={`relative z-[100] pointer-events-none text-center text-[clamp(18px,3.5vw,36px)] font-bold tracking-[0.2em] text-[#e0ffff] uppercase select-none [animation:neonTitlePulse_2s_ease-in-out_infinite_alternate,glitch_5s_infinite] [text-shadow:0_0_10px_rgba(0,255,255,1),0_0_25px_rgba(0,255,255,0.8),0_0_50px_rgba(0,255,255,0.6),0_0_100px_rgba(0,255,255,0.4)] before:absolute before:inset-0 before:-z-10 before:text-[#f0f] before:content-[attr(data-text)] before:[animation:glitchLayer1_5s_infinite] after:absolute after:inset-0 after:-z-10 after:text-[#0ff] after:content-[attr(data-text)] after:[animation:glitchLayer2_5s_infinite] ${target ? 'hidden' : ''}`}
        >
          Д4 Технологии
        </h1>
        <canvas
          ref={headerLogoCanvas}
          aria-label="Д4 Технологии"
          className={`relative z-[100] block h-auto w-[clamp(280px,55vmin,500px)] [animation:neonGlowLogo_2s_ease-in-out_infinite_alternate] [filter:drop-shadow(0_0_12px_rgba(0,255,255,1))_drop-shadow(0_0_30px_rgba(0,255,255,0.8))_drop-shadow(0_0_60px_rgba(0,255,255,0.6))_drop-shadow(0_0_100px_rgba(0,255,255,0.4))] ${target ? '' : 'hidden'}`}
        />

        <Cube ref={cubeHandleRef} audio={audio} onFaceActivated={(face) => navigateTo({ face })} canActivateFace={() => target === null} visualState={cubeVisual} />

        <PageShell target={target} navigateTo={navigateTo} audio={audio} onDefaultClose={hideToCube} />
      </div>

      <SiteFooter navigateTo={navigateTo} />
    </>
  )
}
