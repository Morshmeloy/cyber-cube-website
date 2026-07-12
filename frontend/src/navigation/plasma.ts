import type { AudioEngine } from '../audio/audio-engine.ts'
import type { HeaderChromeElements } from './header-chrome.ts'

const TYPEWRITER_CHAR_DELAY_MS = 30

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

/** Создаёт плазменный информационный экран с эффектом печатающегося ЭЛТ-терминала. */
export function createPlasma(elements: PlasmaElements, audio: AudioEngine, callbacks: PlasmaCallbacks): PlasmaController {
  const { screen, tickerViewport, tickerText, closeButton, scene, neonTitle, headerLogo, backButton } = elements
  let typewriterTimer: ReturnType<typeof setTimeout> | null = null

  function typewrite(text: string): void {
    if (typewriterTimer !== null) {
      clearTimeout(typewriterTimer)
      typewriterTimer = null
    }
    tickerText.textContent = ''
    let i = 0

    function tick(): void {
      if (i >= text.length) return
      tickerText.textContent += text[i]
      i++
      tickerViewport.scrollTop = tickerViewport.scrollHeight
      typewriterTimer = setTimeout(tick, TYPEWRITER_CHAR_DELAY_MS)
    }
    tick()
  }

  function show(color: string, content: string): void {
    audio.playPlasmaOpen()
    screen.style.setProperty('--plasma-color', color)
    callbacks.pauseCubeIdleBehaviour()

    if (callbacks.isSubmenuActive()) {
      callbacks.hideSubmenuCubesOnly()
    }

    backButton.classList.remove('active')
    neonTitle.classList.add('hidden')
    headerLogo.classList.remove('hidden')
    scene.classList.add('minimized')
    document.body.classList.add('plasma-open')
    screen.appendChild(scene)
    screen.classList.add('active')
    typewrite(content)
    callbacks.startCubeMinimizedIdleSpin()
  }

  function hide(): void {
    audio.playPlasmaClose()
    callbacks.stopCubeMinimizedIdleSpin()
    if (typewriterTimer !== null) {
      clearTimeout(typewriterTimer)
      typewriterTimer = null
    }
    callbacks.pauseCubeIdleBehaviour()

    screen.classList.remove('active')
    scene.classList.remove('minimized')
    document.body.classList.remove('plasma-open')
    screen.before(scene)

    if (callbacks.isSubmenuActive()) {
      callbacks.restoreSubmenuCubesOnly()
    } else {
      headerLogo.classList.add('hidden')
      neonTitle.classList.remove('hidden')
    }

    callbacks.resetCubeRotation()
    callbacks.scheduleCubeAutoRotation()
  }

  closeButton.addEventListener('click', hide)

  return {
    show,
    hide,
    isActive: () => screen.classList.contains('active'),
  }
}
