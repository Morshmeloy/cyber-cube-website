import type { FaceName } from './navigation.ts'

export interface CubeCallbacks {
  /** Клик по грани в обычном (не свёрнутом) состоянии куба, когда активация разрешена. */
  onFaceActivated(face: FaceName): void
  /** Клик по свёрнутому кубу (миниатюра поверх открытого плазменного экрана). */
  onMinimizedClick(): void
  /** Позволяет вызывающему коду временно запретить активацию грани (например, во время анимации). */
  canActivateFace(): boolean
}

export interface CubeController {
  /** Полностью сбрасывает вращение и разгон — используется при закрытии плазменного экрана. */
  resetRotation(): void
  /** Останавливает автовращение и таймер простоя — вызывается при открытии подменю/плазмы. */
  pauseIdleBehaviour(): void
  /** Планирует автовращение через AUTO_ROTATE_IDLE_DELAY_MS простоя. */
  scheduleAutoRotation(): void
  /** Мягкое непрерывное вращение свёрнутой иконки куба, пока открыт плазменный экран. */
  startMinimizedIdleSpin(): void
  stopMinimizedIdleSpin(): void
}
