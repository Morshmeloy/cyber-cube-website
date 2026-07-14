import type { AudioEngine } from '../types/audio.ts'
import { createAudioEngine } from '../audio/audio-engine.ts'
import { startBackgroundSlideshow } from '../background/background-slideshow.ts'
import { createRainEffect } from '../background/rain.ts'
import { applyLumaKeyCutout } from '../background/logo-luma-key.ts'
import { faceColors } from '../settings/navigation/faces.ts'
import { pageContentByFace } from '../settings/navigation/pages/index.ts'
import { legalPageColor, legalPageContent } from '../settings/navigation/pages/legal.ts'
import { LOGO_IMAGE_PATH } from '../settings/site/site.ts'
import type { SiteElements } from '../types/site-elements.ts'
import type { PageNavigationTarget, PrivatePageKey } from '../types/page-content.ts'
import { createCube } from './cube.ts'
import { createPlasma } from './plasma.ts'
import { createSiteFooter } from './footer.ts'
import { createUserMenu } from './user-menu.ts'
import { isAuthenticated } from '../lib/auth.ts'
import { buildDashboardPageContent } from '../settings/navigation/pages/dashboard.ts'
import { PRIVATE_PAGE_COLORS } from '../settings/navigation/private.ts'
import { learningPageContent } from '../settings/navigation/pages/private/learning.ts'
import { warehousePageContent } from '../settings/navigation/pages/private/warehouse.ts'
import { docsPageContent } from '../settings/navigation/pages/private/docs.ts'
import { financePageContent } from '../settings/navigation/pages/private/finance.ts'
import type { PageContent } from '../types/page-content.ts'

const privatePageContentByKey: Record<Exclude<PrivatePageKey, 'dashboard'>, PageContent> = {
  learning: learningPageContent,
  warehouse: warehousePageContent,
  docs: docsPageContent,
  finance: financePageContent,
}

/** Прокидывает faceColors в CSS как переменные, чтобы cube.css не дублировал цвета граней. */
function applyFaceColorCssVariables(): void {
  for (const [face, color] of Object.entries(faceColors)) {
    document.documentElement.style.setProperty(`--face-color-${face}`, color)
  }
}

/**
 * Точка сборки всей интерактивной части сайта: фон, дождь, звук и связка
 * куб → плазменный экран с содержимым грани. Клик по грани куба сразу
 * открывает соответствующую страницу — без промежуточного шага с подменю.
 */
export function initSiteNavigation(elements: SiteElements): void {
  const audio: AudioEngine = createAudioEngine()

  applyFaceColorCssVariables()
  startBackgroundSlideshow(elements.bgLayerA, elements.bgLayerB)
  createRainEffect(elements.rainContainer, elements.trailContainer)
  applyLumaKeyCutout(elements.headerLogoCanvas, LOGO_IMAGE_PATH, { sizeToImage: true })

  const chrome = {
    neonTitle: elements.neonTitle,
    headerLogo: elements.headerLogoCanvas,
  }

  let cube: ReturnType<typeof createCube>
  let plasma: ReturnType<typeof createPlasma>
  let userMenu: ReturnType<typeof createUserMenu>

  /** Открывает страницу по грани, «Правовую информацию» или раздел личного кабинета —
   * общий переход для куба, футера и ссылок/кнопок внутри контента страниц. Грань
   * «Авторизация» ведёт на дашборд напрямую, если пользователь уже вошёл; разделы
   * личного кабинета при выходе/потере сессии откатываются на форму входа. Виджет
   * профиля перерисовывается на каждый переход — состояние входа могло измениться. */
  function openTarget(target: PageNavigationTarget): void {
    if ('legal' in target) {
      plasma.show(legalPageColor, legalPageContent)
      userMenu.update()
      return
    }
    if ('private' in target) {
      if (!isAuthenticated()) {
        plasma.show(faceColors.front, pageContentByFace.front)
        userMenu.update()
        return
      }
      if (target.private === 'dashboard') {
        plasma.show(PRIVATE_PAGE_COLORS.dashboard, buildDashboardPageContent())
      } else {
        // Крестик в разделах кабинета ведёт назад на дашборд, а не сразу к кубу.
        plasma.show(PRIVATE_PAGE_COLORS[target.private], privatePageContentByKey[target.private], {
          onClose: () => openTarget({ private: 'dashboard' }),
        })
      }
      userMenu.update()
      return
    }
    if (target.face === 'front' && isAuthenticated()) {
      plasma.show(PRIVATE_PAGE_COLORS.dashboard, buildDashboardPageContent())
      userMenu.update()
      return
    }
    plasma.show(faceColors[target.face], pageContentByFace[target.face])
    userMenu.update()
  }

  cube = createCube(elements.scene, elements.cube, audio, {
    onFaceActivated(face) {
      openTarget({ face })
    },
    canActivateFace: () => !plasma.isActive(),
  })

  plasma = createPlasma(
    {
      screen: elements.plasmaScreen,
      contentViewport: elements.plasmaContentViewport,
      contentRoot: elements.plasmaContentRoot,
      closeButton: elements.plasmaCloseButton,
      scene: elements.scene,
      ...chrome,
    },
    audio,
    {
      pauseCubeIdleBehaviour: () => cube.pauseIdleBehaviour(),
      resetCubeRotation: () => cube.resetRotation(),
      scheduleCubeAutoRotation: () => cube.scheduleAutoRotation(),
      navigateTo: openTarget,
    },
  )

  createSiteFooter(elements.siteFooterContainer, {
    onNavigate(face) {
      openTarget({ face })
    },
    onOpenLegal() {
      openTarget({ legal: true })
    },
  })

  userMenu = createUserMenu(elements.userMenuContainer, openTarget)
}
