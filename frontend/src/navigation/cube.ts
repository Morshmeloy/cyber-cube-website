import type { AudioEngine } from '../types/audio.ts'
import { cubeFaceDefinitions } from '../settings/navigation/faces.ts'
import { applyLumaKeyCutout } from '../background/logo-luma-key.ts'
import type { FaceName } from '../types/navigation.ts'
import type { CubeCallbacks, CubeController } from '../types/cube.ts'
import {
  DRAG_THRESHOLD_PX,
  ROTATION_DAMPING,
  INERTIA_STOP_VELOCITY,
  SNAP_EASING,
  AUTO_ROTATE_IDLE_DELAY_MS,
  AUTO_ROTATE_RAMP_FRAMES,
} from '../settings/navigation/cube.ts'

interface Rotation {
  x: number
  y: number
}

function resolveFaceFromRotation(rotation: Rotation): FaceName | null {
  const normX = Math.round(rotation.x / 90) * 90
  const normY = ((Math.round(rotation.y / 90) * 90) % 360 + 360) % 360

  if (normX === 90) return 'bottom'
  if (normX === -90) return 'top'
  if (normY < 45 || normY >= 315) return 'front'
  if (normY >= 45 && normY < 135) return 'left'
  if (normY >= 135 && normY < 225) return 'back'
  if (normY >= 225 && normY < 315) return 'right'
  return null
}

/**
 * Создаёт и оживляет главный 3D-куб навигации: строит грани, обрабатывает
 * перетаскивание мышью/тачем с инерцией и привязкой к грани, автовращение
 * в простое и клики по граням.
 */
export function createCube(sceneEl: HTMLElement, cubeEl: HTMLDivElement, audio: AudioEngine, callbacks: CubeCallbacks): CubeController {
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

  // --- Построение граней ---
  for (const face of cubeFaceDefinitions) {
    const div = document.createElement('div')
    div.className = `face ${face.name}`
    const ariaText = face.ariaLabel ?? face.label
    div.innerHTML = `
      <a href="#${face.name}" aria-label="${ariaText}">
        <div class="face-icon">${face.iconHtml}</div>
        <span class="face-label">${face.label}</span>
      </a>`
    cubeEl.appendChild(div)
  }

  // Логотип на лицевой грани рисуется на canvas с вырезанным по яркости фоном.
  cubeEl.querySelectorAll<HTMLCanvasElement>('.face-logo-canvas').forEach((canvas) => {
    const src = canvas.dataset.src
    if (src) applyLumaKeyCutout(canvas, src)
  })

  // Горизонтальные грани компенсируют rotateY отдельным rotateZ, чтобы подпись на них не переворачивалась.
  const topFaceContent = cubeEl.querySelector<HTMLElement>('.top a')
  const bottomFaceContent = cubeEl.querySelector<HTMLElement>('.bottom a')

  function updateCubeTransform(): void {
    cubeEl.style.transform = `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`
    if (topFaceContent) topFaceContent.style.transform = `rotateZ(${rotation.y}deg)`
    if (bottomFaceContent) bottomFaceContent.style.transform = `rotateZ(${-rotation.y}deg)`
  }
  updateCubeTransform()

  // --- Автовращение в простое ---
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

  // --- Привязка к ближайшей грани после отпускания ---
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

  // --- Перетаскивание мышью ---
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    if (sceneEl.classList.contains('hidden')) return

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
  })

  document.addEventListener('mousemove', (e) => {
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
  })

  document.addEventListener('mouseup', (e) => {
    if (e.button !== 0 || !isDragging) return
    isDragging = false
    audio.stopKubSound()
    document.body.style.cursor = 'grab'
    isInertia = true
    applyInertia()
  })

  // --- Перетаскивание тачем ---
  document.addEventListener(
    'touchstart',
    (e) => {
      if (sceneEl.classList.contains('hidden')) return
      isDragging = true
      isInertia = false
      isSnapping = false
      cancelAutoRotation()
      const touch = e.touches[0]
      prevMouse = { x: touch.clientX, y: touch.clientY }
      velocity = { x: 0, y: 0 }
    },
    { passive: true },
  )

  document.addEventListener(
    'touchmove',
    (e) => {
      if (!isDragging) return
      const touch = e.touches[0]
      const dx = touch.clientX - prevMouse.x
      const dy = touch.clientY - prevMouse.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) audio.startKubSound()
      velocity.x = dy * 0.4
      velocity.y = dx * 0.4
      rotation.y += velocity.y
      rotation.x = Math.max(-90, Math.min(90, rotation.x - velocity.x))
      updateCubeTransform()
      prevMouse = { x: touch.clientX, y: touch.clientY }
    },
    { passive: true },
  )

  document.addEventListener('touchend', () => {
    if (!isDragging) return
    isDragging = false
    audio.stopKubSound()
    isInertia = true
    applyInertia()
  })

  document.addEventListener('contextmenu', (e) => e.preventDefault())

  // --- Клик по кубу: активация грани ---
  sceneEl.addEventListener('click', () => {
    if (sceneEl.classList.contains('hidden')) return
    if (hasDragged) return
    if (!callbacks.canActivateFace()) return

    const face = resolveFaceFromRotation(rotation)
    if (face) callbacks.onFaceActivated(face)
  })

  scheduleAutoRotation()

  return {
    resetRotation(): void {
      velocity = { x: 0, y: 0 }
      rotation = { x: 0, y: 0 }
      cubeEl.style.transform = 'rotateX(0deg) rotateY(0deg)'
      if (topFaceContent) topFaceContent.style.transform = 'rotateZ(0deg)'
      if (bottomFaceContent) bottomFaceContent.style.transform = 'rotateZ(0deg)'
    },
    pauseIdleBehaviour,
    scheduleAutoRotation,
  }
}
