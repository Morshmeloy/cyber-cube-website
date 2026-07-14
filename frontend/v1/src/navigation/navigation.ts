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
import type { PageNavigationTarget } from '../types/page-content.ts'
import { createCube } from './cube.ts'
import { createPlasma } from './plasma.ts'
import { createSiteFooter } from './footer.ts'

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

  /** Открывает страницу по грани или «Правовую информацию» — общий переход для куба,
   * футера и ссылок/кнопок внутри контента страниц. */
  function openTarget(target: PageNavigationTarget): void {
    if ('legal' in target) {
      plasma.show(legalPageColor, legalPageContent)
    } else {
      plasma.show(faceColors[target.face], pageContentByFace[target.face])
    }
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
}
