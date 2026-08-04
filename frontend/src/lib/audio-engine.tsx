/**
 * Звуковой движок «электроподстанции»: фоновый гул трансформатора, редкие
 * всплески окружения, звук вращения куба, бум привязки к грани и звуки
 * открытия/закрытия плазменного экрана.
 *
 * Web Audio API требует жеста пользователя для запуска — до первого клика/тача
 * все звуки молчат, план инициализации откладывается до `unlockOnFirstGesture`.
 */
import type { AudioEngine } from '../types/audio.tsx'
import {
  FON_SOUND_URL,
  KUB_SOUND_URL,
  PLASMA_OPEN_SOUND_URL,
  PLASMA_CLOSE_SOUND_URL,
  HUM_RAMP_SECONDS,
  HUM_TARGET_GAIN,
  FON_SOUND_BASE_DELAY_S,
  FON_SOUND_RANDOM_RANGE_S,
} from '../data/audio/audio.tsx'

async function loadAudioBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    return await ctx.decodeAudioData(arrayBuffer)
  } catch (error) {
    console.warn(`Не удалось загрузить ${url}:`, error)
    return null
  }
}

export function createAudioEngine(): AudioEngine {
  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AudioContextCtor()
  let started = false

  // --- Постоянный тихий гул трансформатора (50Гц + гармоники) ---
  const humGain = ctx.createGain()
  humGain.gain.value = 0
  humGain.connect(ctx.destination)

  function startTransformerHum(): void {
    const harmonics: Array<{ f: number; g: number; type: OscillatorType }> = [
      { f: 50, g: 0.08, type: 'sine' },
      { f: 100, g: 0.06, type: 'sine' },
      { f: 150, g: 0.04, type: 'sine' },
      { f: 200, g: 0.025, type: 'sine' },
      { f: 250, g: 0.015, type: 'sine' },
      { f: 50, g: 0.02, type: 'sawtooth' }, // лёгкая "грязь" на низких
    ]
    for (const h of harmonics) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = h.type
      osc.frequency.value = h.f
      gain.gain.value = h.g
      osc.connect(gain)
      gain.connect(humGain)
      osc.start()
    }
    humGain.gain.setValueAtTime(0, ctx.currentTime)
    humGain.gain.linearRampToValueAtTime(HUM_TARGET_GAIN, ctx.currentTime + HUM_RAMP_SECONDS)
    scheduleFonSound()
  }

  // --- Редкие всплески audio/fon.mp3 (каждые ~25-40 секунд) ---
  let fonBuffer: AudioBuffer | null = null
  loadAudioBuffer(ctx, FON_SOUND_URL).then((buffer) => {
    fonBuffer = buffer
  })

  function playFonSound(): void {
    if (!started || !fonBuffer) return
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(ctx.destination)

    const source = ctx.createBufferSource()
    source.buffer = fonBuffer
    source.connect(gain)
    source.start()

    const duration = fonBuffer.duration
    const fadeIn = Math.min(1.5, duration * 0.2)
    const fadeOut = Math.min(2, duration * 0.3)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + fadeIn)
    gain.gain.setValueAtTime(0.2, ctx.currentTime + duration - fadeOut)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration)
    source.onended = () => gain.disconnect()
  }

  function scheduleFonSound(): void {
    if (!started) return
    const delay = (FON_SOUND_BASE_DELAY_S + Math.random() * FON_SOUND_RANDOM_RANGE_S) * 1000
    setTimeout(() => {
      playFonSound()
      scheduleFonSound()
    }, delay)
  }

  // --- Звук вращения куба (audio/kub4.mp3), зацикленный на время перетаскивания ---
  let kubBuffer: AudioBuffer | null = null
  let kubSource: AudioBufferSourceNode | null = null
  let kubPlaying = false
  const kubGain = ctx.createGain()
  kubGain.gain.value = 0
  kubGain.connect(ctx.destination)

  loadAudioBuffer(ctx, KUB_SOUND_URL).then((buffer) => {
    kubBuffer = buffer
  })

  function startKubSound(): void {
    if (!started || !kubBuffer || kubPlaying) return
    kubPlaying = true
    kubSource = ctx.createBufferSource()
    kubSource.buffer = kubBuffer
    kubSource.loop = true
    kubSource.connect(kubGain)
    kubSource.start()
    kubGain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.15)
  }

  function stopKubSound(): void {
    if (!kubPlaying) return
    kubGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3)
    const source = kubSource
    setTimeout(() => {
      try {
        source?.stop()
      } catch {
        /* источник уже остановлен */
      }
    }, 350)
    kubPlaying = false
    kubSource = null
  }

  // --- Бум при привязке куба к грани ---
  function playSnapBoom(): void {
    if (!started) return
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(80, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.2)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.35, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  }

  // --- Звуки открытия/закрытия плазменного экрана ---
  let openBuffer: AudioBuffer | null = null
  let closeBuffer: AudioBuffer | null = null
  loadAudioBuffer(ctx, PLASMA_OPEN_SOUND_URL).then((buffer) => {
    openBuffer = buffer
  })
  loadAudioBuffer(ctx, PLASMA_CLOSE_SOUND_URL).then((buffer) => {
    closeBuffer = buffer
  })

  function playOneShot(buffer: AudioBuffer | null): void {
    if (!started || !buffer) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = 0.3
    source.connect(gain)
    gain.connect(ctx.destination)
    source.start()
  }

  const playPlasmaOpen = () => playOneShot(openBuffer)
  const playPlasmaClose = () => playOneShot(closeBuffer)

  // --- Тихий "моторный" гул во время автовращения в простое ---
  let idleOsc1: OscillatorNode | null = null
  let idleOsc2: OscillatorNode | null = null
  let idleLfo: OscillatorNode | null = null
  let idleGain: GainNode | null = null

  function startIdleRotateSound(): void {
    if (!started || idleOsc1) return
    if (!idleGain) {
      idleGain = ctx.createGain()
      idleGain.gain.value = 0
      idleGain.connect(ctx.destination)
    }
    const now = ctx.currentTime

    idleOsc1 = ctx.createOscillator()
    idleOsc1.type = 'triangle'
    idleOsc1.frequency.value = 180
    const g1 = ctx.createGain()
    g1.gain.value = 0.06
    idleOsc1.connect(g1)
    g1.connect(idleGain)
    idleOsc1.start()

    idleOsc2 = ctx.createOscillator()
    idleOsc2.type = 'sine'
    idleOsc2.frequency.value = 360
    const g2 = ctx.createGain()
    g2.gain.value = 0.025
    idleOsc2.connect(g2)
    g2.connect(idleGain)
    idleOsc2.start()

    idleLfo = ctx.createOscillator()
    idleLfo.type = 'sine'
    idleLfo.frequency.value = 1.2
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.02
    idleLfo.connect(lfoGain)
    lfoGain.connect(idleGain.gain)
    idleLfo.start()

    idleGain.gain.setValueAtTime(0, now)
    idleGain.gain.linearRampToValueAtTime(0.5, now + 1.5)
  }

  function stopIdleRotateSound(): void {
    if (!idleOsc1 || !idleGain) return
    const now = ctx.currentTime
    idleGain.gain.linearRampToValueAtTime(0, now + 0.5)
    const [o1, o2, lfo] = [idleOsc1, idleOsc2, idleLfo]
    setTimeout(() => {
      try {
        o1?.stop()
      } catch {
        /* уже остановлен */
      }
      try {
        o2?.stop()
      } catch {
        /* уже остановлен */
      }
      try {
        lfo?.stop()
      } catch {
        /* уже остановлен */
      }
    }, 600)
    idleOsc1 = null
    idleOsc2 = null
    idleLfo = null
  }

  function unlockOnFirstGesture(): void {
    if (started) return
    started = true
    if (ctx.state === 'suspended') ctx.resume()
    startTransformerHum()
  }

  // Звук на сайте временно отключён целиком: `started` никогда не станет true
  // (все play-функции начинаются с `if (!started) return`), раскомментировать
  // эти две строки — единственный способ снова включить звук.
  // document.addEventListener('click', unlockOnFirstGesture, { once: true })
  // document.addEventListener('touchstart', unlockOnFirstGesture, { once: true, passive: true })
  void unlockOnFirstGesture

  return {
    startKubSound,
    stopKubSound,
    playSnapBoom,
    playPlasmaOpen,
    playPlasmaClose,
    startIdleRotateSound,
    stopIdleRotateSound,
  }
}
