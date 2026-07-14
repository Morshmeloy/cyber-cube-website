import type { HeaderChromeElements } from './site-elements.ts'
import type { PageContent, PageLinkTarget } from './page-content.ts'

export interface PlasmaElements extends HeaderChromeElements {
  screen: HTMLElement
  /** Скроллируемый контейнер панели — автоскроллится к началу при открытии новой страницы. */
  contentViewport: HTMLElement
  /** Корневой узел, в который рендерятся блоки текущей страницы. */
  contentRoot: HTMLElement
  closeButton: HTMLButtonElement
  /** Контейнер главного куба (.scene) — на время показа сворачивается в иконку внутри экрана. */
  scene: HTMLElement
}

export interface PlasmaCallbacks {
  pauseCubeIdleBehaviour(): void
  resetCubeRotation(): void
  scheduleCubeAutoRotation(): void
  /** Переход по ссылке/кнопке внутри контента страницы — работает как навигация в футере. */
  navigateTo(target: PageLinkTarget): void
}

export interface PlasmaController {
  show(color: string, content: PageContent): void
  hide(): void
  isActive(): boolean
}
