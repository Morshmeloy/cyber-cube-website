import type { FaceName } from './navigation.ts'
import type { HeaderChromeElements } from './site-elements.ts'

export interface SubmenuCallbacks {
  /** Клик по одному из 27 маленьких кубов подменю. */
  onMiniCubeActivated(index: number, faceName: FaceName): void
  /** Подменю начинает разворачиваться — главный куб должен приостановить своё автовращение. */
  onExpandStarted(): void
  /** Подменю полностью свернулось обратно в главный куб — можно возобновлять его автовращение. */
  onCollapseFinished(): void
}

export interface SubmenuElements extends HeaderChromeElements {
  container: HTMLElement
  group: HTMLElement
  /** Контейнер главного куба (.scene) — на время показа подменю анимированно прячется. */
  scene: HTMLElement
}

export interface SubmenuController {
  /** Полное превращение главного куба в разлетающееся подменю выбранной грани. */
  show(faceName: FaceName): void
  /** Полный гравитационный коллапс подменю обратно в главный куб. */
  hide(): void
  /** Плазменный экран открыт поверх подменю — просто прячем кубы, не разворачивая куб обратно. */
  hideCubesOnly(): void
  /** Плазменный экран закрылся — снова показываем ранее скрытые кубы подменю. */
  restoreCubesOnly(): void
  isActive(): boolean
}
