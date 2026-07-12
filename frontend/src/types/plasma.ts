import type { HeaderChromeElements } from './site-elements.ts'

export interface PlasmaElements extends HeaderChromeElements {
  screen: HTMLElement
  /** Скроллируемый контейнер терминала — нужен, чтобы автоскроллить его при печати текста. */
  tickerViewport: HTMLElement
  tickerText: HTMLElement
  closeButton: HTMLButtonElement
  /** Контейнер главного куба (.scene) — на время показа сворачивается в иконку внутри экрана. */
  scene: HTMLElement
}

export interface PlasmaCallbacks {
  isSubmenuActive(): boolean
  hideSubmenuCubesOnly(): void
  restoreSubmenuCubesOnly(): void
  pauseCubeIdleBehaviour(): void
  resetCubeRotation(): void
  scheduleCubeAutoRotation(): void
  startCubeMinimizedIdleSpin(): void
  stopCubeMinimizedIdleSpin(): void
}

export interface PlasmaController {
  show(color: string, content: string): void
  hide(): void
  isActive(): boolean
}
