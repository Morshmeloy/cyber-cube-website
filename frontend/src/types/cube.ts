import type { FaceName } from './navigation.ts'

export interface CubeCallbacks {
  /** Клик по грани куба, когда активация разрешена. */
  onFaceActivated(face: FaceName): void
  /** Позволяет вызывающему коду временно запретить активацию грани (например, во время анимации). */
  canActivateFace(): boolean
}

export interface CubeController {
  /** Полностью сбрасывает вращение и разгон — используется при закрытии плазменного экрана. */
  resetRotation(): void
  /** Останавливает автовращение и таймер простоя — вызывается при открытии плазменного экрана. */
  pauseIdleBehaviour(): void
  /** Планирует автовращение через AUTO_ROTATE_IDLE_DELAY_MS простоя. */
  scheduleAutoRotation(): void
}
