import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { AudioEngine } from '@/types/audio.tsx'
import type { FaceName } from '@/types/navigation.tsx'
import {
  DRAG_THRESHOLD_PX,
  ROTATION_DAMPING,
  INERTIA_STOP_VELOCITY,
  SNAP_EASING,
  AUTO_ROTATE_IDLE_DELAY_MS,
  AUTO_ROTATE_RAMP_FRAMES,
} from '@/data/navigation/cube.tsx'

interface Rotation {
  x: number
  y: number
}

export interface CubeHandle {
  /** Полностью сбрасывает вращение и разгон — используется при закрытии панели страницы. */
  resetRotation(): void
  /** Останавливает автовращение и таймер простоя — вызывается при открытии панели страницы. */
  pauseIdleBehaviour(): void
  /** Планирует автовращение через AUTO_ROTATE_IDLE_DELAY_MS простоя. */
  scheduleAutoRotation(): void
}

interface UseCubeOptions {
  sceneRef: RefObject<HTMLDivElement | null>
  cubeRef: RefObject<HTMLDivElement | null>
  topFaceContentRef: RefObject<HTMLAnchorElement | null>
  bottomFaceContentRef: RefObject<HTMLAnchorElement | null>
  audio: AudioEngine
  onFaceActivated: (face: FaceName) => void
  canActivateFace: () => boolean
}

function resolveFaceFromRotation(rotation: Rotation): FaceName | null {
  const normX = Math.round(rotation.x / 90) * 90
  const normY = (((Math.round(rotation.y / 90) * 90) % 360) + 360) % 360

  if (normX === 90) return 'bottom'
  if (normX === -90) return 'top'
  if (normY < 45 || normY >= 315) return 'front'
  if (normY >= 45 && normY < 135) return 'left'
  if (normY >= 135 && normY < 225) return 'back'
  if (normY >= 225 && normY < 315) return 'right'
  return null
}

/**
 * Порт логики navigation/cube.ts (drag/инерция/snap-к-грани/автовращение) на React —
 * математика и тайминги не менялись, только DOM-узлы приходят через refs вместо
 * getElementById, а не строятся самим хуком. Состояние физики живёт в refs, а не в
 * useState: обновляется на каждый кадр/событие мыши, ре-рендер React здесь не нужен
 * и только тормозил бы 60fps-анимацию.
 */
export function useCube(options: UseCubeOptions): RefObject<CubeHandle> {
  const { sceneRef, cubeRef, topFaceContentRef, bottomFaceContentRef, audio, onFaceActivated, canActivateFace } = options

  const handleRef = useRef<CubeHandle>({
    resetRotation: () => {},
    pauseIdleBehaviour: () => {},
    scheduleAutoRotation: () => {},
  })

  // Актуальные колбэки в refs — чтобы не пересобирать все обработчики при каждом ре-рендере.
  // Синхронизация — эффектом, а не прямым присваиванием в теле компонента (мутировать
  // ref во время рендера запрещено правилами react-hooks/refs).
  const onFaceActivatedRef = useRef(onFaceActivated)
  const canActivateFaceRef = useRef(canActivateFace)
  useEffect(() => {
    onFaceActivatedRef.current = onFaceActivated
    canActivateFaceRef.current = canActivateFace
  })

  useEffect(() => {
    const sceneEl = sceneRef.current
    const cubeEl = cubeRef.current
    if (!sceneEl || !cubeEl) return

    let isDragging = false
    let isSnapping = false
    let isInertia = false
    let autoRotationId: number | null = null
    let idleTimeout: ReturnType<typeof setTimeout> | null = null
    let rotation: Rotation = { x: 0, y: 0 }
    let velocity: Rotation = { x: 0, y: 0 }
    let prevMouse = { x: 0, y: 0 }
    let dragStartMouse = { x: 0, y: 0 }
    let hasDragged = false

    const topFaceContent = topFaceContentRef.current
    const bottomFaceContent = bottomFaceContentRef.current

    function updateCubeTransform(): void {
      cubeEl!.style.transform = `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`
      if (topFaceContent) topFaceContent.style.transform = `rotateZ(${rotation.y}deg)`
      if (bottomFaceContent) bottomFaceContent.style.transform = `rotateZ(${-rotation.y}deg)`
    }
    updateCubeTransform()

    function cancelAutoRotation(): void {
      if (autoRotationId !== null) {
        cancelAnimationFrame(autoRotationId)
        autoRotationId = null
      }
      audio.stopIdleRotateSound()
    }

    function startAutoRotation(): void {
      cancelAutoRotation()
      audio.startIdleRotateSound()
      let frame = 0
      const startY = rotation.y
      const startX = rotation.x

      function rotateStep(): void {
        frame += 1
        const ramp = Math.min(frame / AUTO_ROTATE_RAMP_FRAMES, 1)
        const ease = ramp * ramp * (3 - 2 * ramp) // smoothstep
        const speed = ease * 0.011
        const t = frame * speed
        rotation.y = startY + t * 50 + Math.sin(t * 0.9) * 30 * ease + Math.cos(t * 1.7) * 20 * ease
        rotation.x = startX * (1 - ease) + (Math.sin(t * 1.1) * 60 + Math.sin(t * 0.5) * 40 + Math.cos(t * 2.1) * 20) * ease
        updateCubeTransform()
        autoRotationId = requestAnimationFrame(rotateStep)
      }
      rotateStep()
    }

    function scheduleAutoRotation(): void {
      if (idleTimeout) clearTimeout(idleTimeout)
      idleTimeout = setTimeout(() => {
        if (!isDragging && !isSnapping) startAutoRotation()
      }, AUTO_ROTATE_IDLE_DELAY_MS)
    }

    function pauseIdleBehaviour(): void {
      cancelAutoRotation()
      if (idleTimeout) clearTimeout(idleTimeout)
    }

    function snapToFace(): void {
      if (isSnapping) return
      isSnapping = true
      const targetX = Math.round(rotation.x / 90) * 90
      const targetY = Math.round(rotation.y / 90) * 90

      function animate(): void {
        rotation.x += (targetX - rotation.x) * SNAP_EASING
        rotation.y += (targetY - rotation.y) * SNAP_EASING
        if (Math.abs(targetX - rotation.x) < 0.3 && Math.abs(targetY - rotation.y) < 0.3) {
          rotation.x = targetX
          rotation.y = targetY
          updateCubeTransform()
          isSnapping = false
          hasDragged = false
          audio.playSnapBoom()
          scheduleAutoRotation()
          return
        }
        updateCubeTransform()
        requestAnimationFrame(animate)
      }
      animate()
    }

    function applyInertia(): void {
      if (!isInertia) return
      if (Math.abs(velocity.x) < INERTIA_STOP_VELOCITY && Math.abs(velocity.y) < INERTIA_STOP_VELOCITY) {
        isInertia = false
        snapToFace()
        return
      }
      velocity.x *= ROTATION_DAMPING
      velocity.y *= ROTATION_DAMPING
      rotation.x = Math.max(-90, Math.min(90, rotation.x - velocity.x))
      rotation.y += velocity.y
      updateCubeTransform()
      requestAnimationFrame(applyInertia)
    }

    function onMouseDown(e: MouseEvent): void {
      if (e.button !== 0) return
      if (sceneEl!.classList.contains('hidden')) return
      if (!sceneEl!.contains(e.target as Node)) return

      isDragging = true
      isInertia = false
      isSnapping = false
      hasDragged = false
      cancelAutoRotation()
      if (idleTimeout) clearTimeout(idleTimeout)
      prevMouse = { x: e.clientX, y: e.clientY }
      dragStartMouse = { x: e.clientX, y: e.clientY }
      velocity = { x: 0, y: 0 }
      document.body.style.cursor = 'grabbing'
    }

    function onMouseMove(e: MouseEvent): void {
      if (!isDragging) return
      const dx = e.clientX - prevMouse.x
      const dy = e.clientY - prevMouse.y
      const totalDx = e.clientX - dragStartMouse.x
      const totalDy = e.clientY - dragStartMouse.y
      if (Math.abs(totalDx) > DRAG_THRESHOLD_PX || Math.abs(totalDy) > DRAG_THRESHOLD_PX) {
        hasDragged = true
        audio.startKubSound()
      }
      velocity.x = dy * 0.4
      velocity.y = dx * 0.4
      rotation.y += velocity.y
      rotation.x = Math.max(-90, Math.min(90, rotation.x - velocity.x))
      updateCubeTransform()
      prevMouse = { x: e.clientX, y: e.clientY }
    }

    function onMouseUp(e: MouseEvent): void {
      if (e.button !== 0 || !isDragging) return
      isDragging = false
      audio.stopKubSound()
      document.body.style.cursor = 'grab'
      isInertia = true
      applyInertia()
    }

    function onTouchStart(e: TouchEvent): void {
      if (sceneEl!.classList.contains('hidden')) return
      if (!sceneEl!.contains(e.target as Node)) return
      isDragging = true
      isInertia = false
      isSnapping = false
      cancelAutoRotation()
      const touch = e.touches[0]
      prevMouse = { x: touch.clientX, y: touch.clientY }
      velocity = { x: 0, y: 0 }
    }

    function onTouchMove(e: TouchEvent): void {
      if (!isDragging) return
      e.preventDefault()
      const touch = e.touches[0]
      const dx = touch.clientX - prevMouse.x
      const dy = touch.clientY - prevMouse.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) audio.startKubSound()
      // Множитель выше, чем у мыши (0.4) — на телефоне палец физически проходит
      // намного меньше пикселей за один свайп, чем мышь на десктопе, иначе грань
      // не докручивается до соседней за один жест.
      velocity.x = dy * 0.7
      velocity.y = dx * 0.7
      rotation.y += velocity.y
      rotation.x = Math.max(-90, Math.min(90, rotation.x - velocity.x))
      updateCubeTransform()
      prevMouse = { x: touch.clientX, y: touch.clientY }
    }

    function onTouchEnd(): void {
      if (!isDragging) return
      isDragging = false
      audio.stopKubSound()
      isInertia = true
      applyInertia()
    }

    function onContextMenu(e: MouseEvent): void {
      // Блокируем контекстное меню только над интерактивной сценой куба. Глобальный
      // document-listener запрещал меню «Копировать/Вставить» во всех формах сайта.
      if (sceneEl!.contains(e.target as Node)) e.preventDefault()
    }

    function onSceneClick(): void {
      if (sceneEl!.classList.contains('hidden')) return
      if (hasDragged) return
      if (!canActivateFaceRef.current()) return

      const face = resolveFaceFromRotation(rotation)
      if (face) onFaceActivatedRef.current(face)
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd)
    sceneEl.addEventListener('contextmenu', onContextMenu)
    sceneEl.addEventListener('click', onSceneClick)

    scheduleAutoRotation()

    // Мутируем поля уже существующего объекта (не заменяем handleRef.current целиком) —
    // useImperativeHandle мог захватить ссылку на него ещё до этого эффекта (порядок
    // между обычным useEffect и useLayoutEffect внутри useImperativeHandle не гарантирован),
    // поэтому важно, чтобы объект оставался тем же самым, просто с актуальными методами.
    handleRef.current.resetRotation = (): void => {
      velocity = { x: 0, y: 0 }
      rotation = { x: 0, y: 0 }
      cubeEl.style.transform = 'rotateX(0deg) rotateY(0deg)'
      if (topFaceContent) topFaceContent.style.transform = 'rotateZ(0deg)'
      if (bottomFaceContent) bottomFaceContent.style.transform = 'rotateZ(0deg)'
    }
    handleRef.current.pauseIdleBehaviour = pauseIdleBehaviour
    handleRef.current.scheduleAutoRotation = scheduleAutoRotation

    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      sceneEl.removeEventListener('contextmenu', onContextMenu)
      sceneEl.removeEventListener('click', onSceneClick)
      if (autoRotationId !== null) cancelAnimationFrame(autoRotationId)
      if (idleTimeout) clearTimeout(idleTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs и audio стабильны на весь жизненный цикл куба
  }, [])

  return handleRef
}
