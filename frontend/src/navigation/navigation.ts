import type { AudioEngine } from '../audio/audio-engine.ts'
import { createAudioEngine } from '../audio/audio-engine.ts'
import { startBackgroundSlideshow } from '../background/background-slideshow.ts'
import { createRainEffect } from '../background/rain.ts'
import { applyLumaKeyCutout } from '../background/logo-luma-key.ts'
import { faceColors } from '../data/faces.ts'
import { createCube } from './cube.ts'
import { createSubmenu } from './submenu.ts'
import { createPlasma } from './plasma.ts'

export interface SiteElements {
  bgLayerA: HTMLElement
  bgLayerB: HTMLElement
  rainContainer: HTMLElement
  trailContainer: HTMLElement
  neonTitle: HTMLElement
  headerLogoCanvas: HTMLCanvasElement
  scene: HTMLElement
  cube: HTMLDivElement
  plasmaScreen: HTMLElement
  plasmaTickerViewport: HTMLElement
  plasmaText: HTMLElement
  plasmaCloseButton: HTMLButtonElement
  submenuContainer: HTMLElement
  submenuGroup: HTMLElement
  backButton: HTMLButtonElement
}

/**
 * Точка сборки всей интерактивной части сайта: фон, дождь, звук и связка
 * куб → подменю → плазменный экран. Сами куб/подменю/плазма не знают друг
 * о друге напрямую — здесь они соединяются узкими колбэками.
 */
export function initSiteNavigation(elements: SiteElements): void {
  const audio: AudioEngine = createAudioEngine()

  startBackgroundSlideshow(elements.bgLayerA, elements.bgLayerB)
  createRainEffect(elements.rainContainer, elements.trailContainer)
  applyLumaKeyCutout(elements.headerLogoCanvas, '/images/logo.jpg', { sizeToImage: true })

  const chrome = {
    neonTitle: elements.neonTitle,
    headerLogo: elements.headerLogoCanvas,
    backButton: elements.backButton,
  }

  // Контроллеры создаются в этом порядке из-за перекрёстных ссылок в колбэках ниже;
  // объявляем переменные заранее и используем стрелочные обёртки, чтобы разорвать цикл инициализации.
  let cube: ReturnType<typeof createCube>
  let submenu: ReturnType<typeof createSubmenu>
  let plasma: ReturnType<typeof createPlasma>

  cube = createCube(elements.scene, elements.cube, audio, {
    onFaceActivated(face) {
      submenu.show(face)
    },
    onMinimizedClick() {
      plasma.hide()
    },
    canActivateFace: () => !plasma.isActive() && !submenu.isActive(),
  })

  submenu = createSubmenu({ container: elements.submenuContainer, group: elements.submenuGroup, scene: elements.scene, ...chrome }, faceColors, audio, {
    onMiniCubeActivated(index, faceName) {
      const placeholderContent = `Подменю ${index} — ${faceName}\n\nЗдесь будет контент для элемента ${index}`
      plasma.show(faceColors[faceName] ?? '#0ff', placeholderContent)
    },
    onExpandStarted: () => cube.pauseIdleBehaviour(),
    onCollapseFinished: () => cube.scheduleAutoRotation(),
  })

  plasma = createPlasma(
    {
      screen: elements.plasmaScreen,
      tickerViewport: elements.plasmaTickerViewport,
      tickerText: elements.plasmaText,
      closeButton: elements.plasmaCloseButton,
      scene: elements.scene,
      ...chrome,
    },
    audio,
    {
      isSubmenuActive: () => submenu.isActive(),
      hideSubmenuCubesOnly: () => submenu.hideCubesOnly(),
      restoreSubmenuCubesOnly: () => submenu.restoreCubesOnly(),
      pauseCubeIdleBehaviour: () => cube.pauseIdleBehaviour(),
      resetCubeRotation: () => cube.resetRotation(),
      scheduleCubeAutoRotation: () => cube.scheduleAutoRotation(),
      startCubeMinimizedIdleSpin: () => cube.startMinimizedIdleSpin(),
      stopCubeMinimizedIdleSpin: () => cube.stopMinimizedIdleSpin(),
    },
  )

  elements.backButton.addEventListener('click', () => {
    if (plasma.isActive()) {
      plasma.hide()
    } else {
      submenu.hide()
    }
  })
}
