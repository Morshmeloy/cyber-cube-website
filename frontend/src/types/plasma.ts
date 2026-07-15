import type { HeaderChromeElements } from './site-elements.ts'
import type { PageContent, PageNavigationTarget } from './page-content.ts'

export interface PlasmaElements extends HeaderChromeElements {
  screen: HTMLElement
  /** Скроллируемый контейнер панели — автоскроллится к началу при открытии новой страницы. */
  contentViewport: HTMLElement
  /** Корневой узел, в который рендерятся блоки текущей страницы. */
  contentRoot: HTMLElement
  closeButton: HTMLButtonElement
  expandButton: HTMLButtonElement
  /** Контейнер главного куба (.scene) — на время показа сворачивается в иконку внутри экрана. */
  scene: HTMLElement
}

export interface PlasmaCallbacks {
  pauseCubeIdleBehaviour(): void
  resetCubeRotation(): void
  scheduleCubeAutoRotation(): void
  /** Переход по ссылке/кнопке внутри контента страницы — работает как навигация в футере. */
  navigateTo(target: PageNavigationTarget): void
}

export interface PlasmaShowOptions {
  /** Переопределяет действие крестика для этого показа — например, разделы личного
   * кабинета возвращают не к кубу, а на дашборд. Сбрасывается на дефолт при следующем show(). */
  onClose?: () => void
}

export interface PlasmaController {
  show(color: string, content: PageContent, options?: PlasmaShowOptions): void
  hide(): void
  isActive(): boolean
}
