import type { AudioEngine } from '../types/audio.ts'
import type { PlasmaElements, PlasmaCallbacks, PlasmaController } from '../types/plasma.ts'
import { TYPEWRITER_CHAR_DELAY_MS } from '../settings/navigation/plasma.ts'

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
