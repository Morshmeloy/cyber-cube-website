import type { AudioEngine } from '../types/audio.ts'
import { FACE_NAMES, type FaceName } from '../types/navigation.ts'
import type { SubmenuCallbacks, SubmenuElements, SubmenuController } from '../types/submenu.ts'
import {
  GRID_AXIS,
  MINI_SIZE_PX,
  MINI_SPACING_PX,
  GROUP_IDLE_DELAY_MS,
  GROUP_SNAP_EASING,
  GROUP_INERTIA_DAMPING,
  GROUP_INERTIA_STOP_VELOCITY,
  EXPLODE_OUTWARD_IMPULSE_MS,
  COLLAPSE_DURATION_MS,
} from '../settings/navigation/submenu.ts'

interface MiniCubeSlot {
  wrapper: HTMLElement
  index: number
  /** Смещение от центра в пикселях, куда куб возвращается в состоянии покоя. */
  restX: number
  restY: number
  restZ: number
  distanceFromCenter: number
}

interface GroupRotation {
  x: number
  y: number
  z: number
}

function buildMiniCubeSlots(groupEl: HTMLElement, faceColors: Record<FaceName, string>): MiniCubeSlot[] {
  const slots: MiniCubeSlot[] = []
  let index = 1

  for (const z of GRID_AXIS) {
    for (const y of GRID_AXIS) {
      for (const x of GRID_AXIS) {
        const wrapper = document.createElement('div')
        wrapper.className = 'mini-cube-wrapper'
        wrapper.dataset.index = String(index)
        wrapper.style.width = `${MINI_SIZE_PX}px`
        wrapper.style.height = `${MINI_SIZE_PX}px`
        wrapper.style.setProperty('--mini-size', `${MINI_SIZE_PX}px`)
        wrapper.style.left = '0'
        wrapper.style.top = '0'
        wrapper.style.marginLeft = `${-MINI_SIZE_PX / 2}px`
        wrapper.style.marginTop = `${-MINI_SIZE_PX / 2}px`

        const miniCube = document.createElement('div')
        miniCube.className = 'mini-cube'
        for (const faceName of FACE_NAMES) {
          const face = document.createElement('div')
          face.className = `mini-face ${faceName}`
          face.style.background = faceColors[faceName]
          face.style.boxShadow = `0 0 20px ${faceColors[faceName]}40, inset 0 0 30px ${faceColors[faceName]}20`
          face.textContent = String(index)
          miniCube.appendChild(face)
        }
        wrapper.appendChild(miniCube)
        groupEl.appendChild(wrapper)

        slots.push({
          wrapper,
          index,
          restX: x * MINI_SPACING_PX,
          restY: -y * MINI_SPACING_PX,
          restZ: z * MINI_SPACING_PX,
          distanceFromCenter: Math.sqrt(x * x + y * y + z * z),
        })
        index++
      }
    }
  }
  return slots
}

/**
 * Создаёт подменю из 27 маленьких кубов (сетка 3×3×3), которое разлетается
 * из главного куба при выборе грани и гравитационно схлопывается обратно.
 */
export function createSubmenu(elements: SubmenuElements, faceColors: Record<FaceName, string>, audio: AudioEngine, callbacks: SubmenuCallbacks): SubmenuController {
  const { container, group, scene, neonTitle, headerLogo, backButton } = elements
  const slots = buildMiniCubeSlots(group, faceColors)

  let activeFace: FaceName | null = null
  let groupRotation: GroupRotation = { x: -25, y: 35, z: 0 }
  let groupVelocity = { x: 0, y: 0 }
  let groupRotationFrame: number | null = null
  let groupIdleTimeout: ReturnType<typeof setTimeout> | null = null
  let isDraggingGroup = false
  let isGroupSnapping = false
  let isGroupInertia = false
  let prevGroupMouse = { x: 0, y: 0 }

  function applyGroupTransform(): void {
    group.style.transform = `rotateX(${groupRotation.x}deg) rotateY(${groupRotation.y}deg) rotateZ(${groupRotation.z}deg)`
  }

  slots.forEach((slot) => {
    slot.wrapper.addEventListener('click', () => {
      if (!activeFace) return
      callbacks.onMiniCubeActivated(slot.index, activeFace)
    })
  })

  // --- Автовращение группы кубов в простое ---
  function stopGroupRotation(): void {
    if (groupRotationFrame !== null) {
      cancelAnimationFrame(groupRotationFrame)
      groupRotationFrame = null
    }
  }

  function startGroupRotation(): void {
    if (groupRotationFrame !== null) return
    function animate(): void {
      if (!container.classList.contains('active') || isDraggingGroup) {
        groupRotationFrame = null
        return
      }
      groupRotation.x += 0.1
      groupRotation.y += 0.15
      groupRotation.z += 0.075
      applyGroupTransform()
      groupRotationFrame = requestAnimationFrame(animate)
    }
    groupRotationFrame = requestAnimationFrame(animate)
  }

  function scheduleGroupIdleRotation(): void {
    if (groupIdleTimeout) clearTimeout(groupIdleTimeout)
    groupIdleTimeout = setTimeout(() => {
      if (!isDraggingGroup && !isGroupSnapping) startGroupRotation()
    }, GROUP_IDLE_DELAY_MS)
  }

  // --- Перетаскивание группы кубов мышью ---
  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('.mini-cube-wrapper')) return

    isDraggingGroup = true
    isGroupInertia = false
    isGroupSnapping = false
    stopGroupRotation()
    if (groupIdleTimeout) clearTimeout(groupIdleTimeout)
    prevGroupMouse = { x: e.clientX, y: e.clientY }
    groupVelocity = { x: 0, y: 0 }
  })

  document.addEventListener('mousemove', (e) => {
    if (!isDraggingGroup) return
    const dx = e.clientX - prevGroupMouse.x
    const dy = e.clientY - prevGroupMouse.y
    groupVelocity.x = dy * 0.4
    groupVelocity.y = dx * 0.4
    groupRotation.y += groupVelocity.y
    groupRotation.x -= groupVelocity.x
    applyGroupTransform()
    prevGroupMouse = { x: e.clientX, y: e.clientY }
  })

  document.addEventListener('mouseup', () => {
    if (!isDraggingGroup) return
    isDraggingGroup = false
    isGroupInertia = true
    applyGroupInertia()
  })

  function applyGroupInertia(): void {
    if (!isGroupInertia) return
    if (Math.abs(groupVelocity.x) < GROUP_INERTIA_STOP_VELOCITY && Math.abs(groupVelocity.y) < GROUP_INERTIA_STOP_VELOCITY) {
      isGroupInertia = false
      snapGroupToAxis()
      return
    }
    groupVelocity.x *= GROUP_INERTIA_DAMPING
    groupVelocity.y *= GROUP_INERTIA_DAMPING
    groupRotation.x -= groupVelocity.x
    groupRotation.y += groupVelocity.y
    applyGroupTransform()
    requestAnimationFrame(applyGroupInertia)
  }

  function snapGroupToAxis(): void {
    if (isGroupSnapping) return
    isGroupSnapping = true
    const targetX = Math.round(groupRotation.x / 90) * 90
    const targetY = Math.round(groupRotation.y / 90) * 90
    const targetZ = Math.round(groupRotation.z / 90) * 90

    function animate(): void {
      groupRotation.x += (targetX - groupRotation.x) * GROUP_SNAP_EASING
      groupRotation.y += (targetY - groupRotation.y) * GROUP_SNAP_EASING
      groupRotation.z += (targetZ - groupRotation.z) * GROUP_SNAP_EASING
      const settled =
        Math.abs(targetX - groupRotation.x) < 0.3 && Math.abs(targetY - groupRotation.y) < 0.3 && Math.abs(targetZ - groupRotation.z) < 0.3
      if (settled) {
        groupRotation = { x: targetX, y: targetY, z: targetZ }
        applyGroupTransform()
        isGroupSnapping = false
        audio.playSnapBoom()
        scheduleGroupIdleRotation()
        return
      }
      applyGroupTransform()
      requestAnimationFrame(animate)
    }
    animate()
  }

  // --- Разворачивание подменю из главного куба ---
  function show(faceName: FaceName): void {
    activeFace = faceName
    callbacks.onExpandStarted()

    stopGroupRotation()
    if (groupIdleTimeout) clearTimeout(groupIdleTimeout)
    isGroupSnapping = false
    isGroupInertia = false
    groupVelocity = { x: 0, y: 0 }
    groupRotation = { x: -25, y: 35, z: 0 }
    applyGroupTransform()

    // Фаза 1: главный куб вспыхивает и "взрывается"
    scene.style.transition = 'opacity 0.15s ease, transform 0.4s cubic-bezier(0.55, 0, 0.675, 0.19)'
    scene.style.transform = 'translate(-50%, -50%) scale(1.25)'
    scene.style.opacity = '0.9'
    setTimeout(() => {
      scene.style.transform = 'translate(-50%, -50%) scale(0) rotate(45deg)'
      scene.style.opacity = '0'
    }, 120)

    // Фаза 2: маленькие кубы стартуют из центра, маленькими и с случайным поворотом
    slots.forEach((slot) => {
      const rx = (Math.random() - 0.5) * 720
      const ry = (Math.random() - 0.5) * 720
      const rz = (Math.random() - 0.5) * 360
      slot.wrapper.style.transition = 'none'
      slot.wrapper.style.transform = `translate3d(0px, 0px, 0px) scale(0.05) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`
      slot.wrapper.style.opacity = '0'
    })

    setTimeout(() => {
      scene.style.display = 'none'
      scene.style.transition = ''
      scene.style.transform = ''
      scene.style.opacity = ''
      container.classList.add('active')
      backButton.classList.add('active')
      neonTitle.classList.add('hidden')
      headerLogo.classList.remove('hidden')

      // Фаза 3: волна разлёта — задержка каждого куба зависит от расстояния до центра
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          let maxDelay = 0
          slots.forEach((slot) => {
            const delay = slot.distanceFromCenter * 60
            const duration = 800 + slot.distanceFromCenter * 120
            maxDelay = Math.max(maxDelay, delay + duration)
            setTimeout(() => {
              slot.wrapper.style.transition = `transform ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms ease`
              slot.wrapper.style.transform = `translate3d(${slot.restX}px, ${slot.restY}px, ${slot.restZ}px)`
              slot.wrapper.style.opacity = '1'
            }, delay)
          })

          setTimeout(() => {
            slots.forEach((slot) => {
              slot.wrapper.style.transition = ''
            })
            scheduleGroupIdleRotation()
          }, maxDelay + 50)
        })
      })
    }, 450)
  }

  // --- Гравитационный коллапс подменю обратно в главный куб ---
  function hide(): void {
    stopGroupRotation()
    backButton.classList.remove('active')

    // Фаза 1: короткий импульс наружу
    slots.forEach((slot) => {
      slot.wrapper.style.transition = 'transform 80ms ease-out, opacity 80ms ease'
      slot.wrapper.style.transform = `translate3d(${slot.restX * 1.18}px, ${slot.restY * 1.18}px, ${slot.restZ * 1.18}px) scale(1.05)`
    })

    setTimeout(() => {
      const spins = slots.map(() => (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360))
      const startTime = performance.now()

      function animateCollapse(now: number): void {
        const t = Math.min((now - startTime) / COLLAPSE_DURATION_MS, 1)
        const ease = t * t * t * t // резкое ускорение к концу

        slots.forEach((slot, i) => {
          const cx = slot.restX * 1.18 * (1 - ease)
          const cy = slot.restY * 1.18 * (1 - ease)
          const cz = slot.restZ * 1.18 * (1 - ease)
          const scale = Math.max(1.05 - ease * 1.0, 0.01)
          const rotation = ease * spins[i]
          const opacity = t < 0.75 ? 1 : Math.max(1 - (t - 0.75) / 0.25, 0)

          slot.wrapper.style.transition = 'none'
          slot.wrapper.style.transform = `translate3d(${cx}px, ${cy}px, ${cz}px) scale(${scale}) rotateY(${rotation}deg) rotateX(${rotation * 0.4}deg)`
          slot.wrapper.style.opacity = String(opacity)
        })

        if (t < 1) {
          requestAnimationFrame(animateCollapse)
          return
        }

        container.classList.remove('active')
        scene.style.display = 'block'
        scene.style.transition = 'none'
        scene.style.opacity = '1'
        scene.style.transform = 'translate(-50%, -50%) scale(1.4)'

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scene.style.transition = 'transform 0.45s cubic-bezier(0.34, 1.2, 0.64, 1), opacity 0.2s ease'
            scene.style.transform = 'translate(-50%, -50%) scale(1)'
            setTimeout(() => {
              scene.style.transition = ''
              scene.style.opacity = ''
              scene.style.transform = ''
            }, 500)
          })
        })

        headerLogo.classList.add('hidden')
        neonTitle.classList.remove('hidden')
        activeFace = null
        callbacks.onCollapseFinished()
      }

      requestAnimationFrame(animateCollapse)
    }, EXPLODE_OUTWARD_IMPULSE_MS)
  }

  function hideCubesOnly(): void {
    container.style.display = 'none'
    stopGroupRotation()
  }

  function restoreCubesOnly(): void {
    container.style.display = 'block'
    headerLogo.classList.remove('hidden')
    neonTitle.classList.add('hidden')
    backButton.classList.add('active')
    scheduleGroupIdleRotation()
  }

  return {
    show,
    hide,
    hideCubesOnly,
    restoreCubesOnly,
    isActive: () => container.classList.contains('active'),
  }
}
