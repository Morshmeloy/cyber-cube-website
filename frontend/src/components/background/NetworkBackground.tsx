import { useEffect, useRef } from 'react'

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  hub: boolean
  radius: number
  phase: number
  accent: boolean
}

interface Star {
  x: number
  y: number
  radius: number
  baseAlpha: number
  phase: number
  speed: number
  white: boolean
}

interface Pulse {
  fromIdx: number
  toIdx: number
  t: number
}

const MAX_LINK_DISTANCE = 150
const PULSE_STEP = 0.02
// rgb-триплеты var(--primary) (#00d4ff), var(--secondary) (#4ecdc4) и var(--foreground)
// (#e0ffff) — на 2D-canvas var() недоступен, а тема сайта единственная и не переключается
// (см. index.css), так что жёстко зашить их безопасно.
const PRIMARY = '0, 212, 255'
const SECONDARY = '78, 205, 196'
const STAR_WHITE = '224, 255, 255'

/**
 * Фон-«сеть»: узлы (часть — «хабы» с пульсирующим кольцом, часть — второго акцентного
 * цвета для разнообразия) соединены линиями при сближении, мерцают по фазе, по части рёбер
 * бегают «пакеты данных». Позади графа — статичный мерцающий звёздный слой для глубины,
 * чтобы пустые участки экрана не выглядели скучно/пусто. Читается как граф мониторинга
 * сети/устройств, тематически соответствует IT-профилю компании. Canvas 2D, а не DOM-узлы
 * (как в Rain) — дешевле перерисовывать сотни точек на одном canvas.
 */
export function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches
    const nodeCount = isCoarsePointer ? 35 : 70
    const starCount = isCoarsePointer ? 60 : 130
    const maxPulses = isCoarsePointer ? 2 : 5
    // На тач-устройствах не только меньше узлов, но и реже перерисовываем — та же
    // предосторожность, что и в Rain/заголовке: не конкурировать за кадр со вращением куба.
    const targetFrameMs = isCoarsePointer ? 1000 / 24 : 1000 / 60

    let width = 0
    let height = 0
    let nodes: Node[] = []
    let stars: Star[] = []
    let pulses: Pulse[] = []

    function resize(): void {
      width = window.innerWidth
      height = window.innerHeight
      canvas!.width = width
      canvas!.height = height
    }

    function spawnNodes(): void {
      nodes = Array.from({ length: nodeCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        hub: Math.random() < 0.12,
        radius: 1.1 + Math.random(),
        phase: Math.random() * Math.PI * 2,
        accent: Math.random() < 0.1,
      }))
      stars = Array.from({ length: starCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0.5 + Math.random() * 1.3,
        baseAlpha: 0.12 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
        speed: 0.0006 + Math.random() * 0.0012,
        white: Math.random() < 0.25,
      }))
      pulses = []
    }

    resize()
    spawnNodes()
    window.addEventListener('resize', resize)

    let frameId = 0
    let lastFrameTime = 0
    let running = true

    function onVisibilityChange(): void {
      running = document.visibilityState === 'visible'
      if (running) frameId = requestAnimationFrame(tick)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    function trySpawnPulse(): void {
      if (pulses.length >= maxPulses || Math.random() > 0.05) return
      const fromIdx = Math.floor(Math.random() * nodes.length)
      for (let attempt = 0; attempt < 6; attempt++) {
        const toIdx = Math.floor(Math.random() * nodes.length)
        if (toIdx === fromIdx) continue
        const dx = nodes[fromIdx].x - nodes[toIdx].x
        const dy = nodes[fromIdx].y - nodes[toIdx].y
        if (Math.sqrt(dx * dx + dy * dy) <= MAX_LINK_DISTANCE) {
          pulses.push({ fromIdx, toIdx, t: 0 })
          return
        }
      }
    }

    function tick(now: number): void {
      if (!running) return
      frameId = requestAnimationFrame(tick)
      if (now - lastFrameTime < targetFrameMs) return
      lastFrameTime = now

      ctx!.clearRect(0, 0, width, height)

      for (const star of stars) {
        const twinkle = star.baseAlpha * (0.55 + 0.45 * Math.sin(now * star.speed + star.phase))
        ctx!.fillStyle = `rgba(${star.white ? STAR_WHITE : PRIMARY}, ${Math.max(twinkle, 0).toFixed(3)})`
        ctx!.beginPath()
        ctx!.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
        ctx!.fill()
      }

      for (const node of nodes) {
        node.x += node.vx
        node.y += node.vy
        if (node.x < 0 || node.x > width) node.vx *= -1
        if (node.y < 0 || node.y > height) node.vy *= -1
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > MAX_LINK_DISTANCE) continue
          ctx!.strokeStyle = `rgba(${PRIMARY}, ${(0.18 * (1 - dist / MAX_LINK_DISTANCE)).toFixed(3)})`
          ctx!.lineWidth = 1
          ctx!.beginPath()
          ctx!.moveTo(nodes[i].x, nodes[i].y)
          ctx!.lineTo(nodes[j].x, nodes[j].y)
          ctx!.stroke()
        }
      }

      trySpawnPulse()
      pulses = pulses.filter((pulse) => pulse.t < 1)
      for (const pulse of pulses) {
        pulse.t += PULSE_STEP
        const from = nodes[pulse.fromIdx]
        const to = nodes[pulse.toIdx]
        const px = from.x + (to.x - from.x) * pulse.t
        const py = from.y + (to.y - from.y) * pulse.t
        ctx!.fillStyle = `rgba(${PRIMARY}, 0.16)`
        ctx!.beginPath()
        ctx!.arc(px, py, 5, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.fillStyle = `rgba(${PRIMARY}, 0.9)`
        ctx!.beginPath()
        ctx!.arc(px, py, 1.8, 0, Math.PI * 2)
        ctx!.fill()
      }

      for (const node of nodes) {
        const color = node.accent ? SECONDARY : PRIMARY
        const twinkle = 0.4 + 0.35 * Math.sin(now / 1500 + node.phase)
        if (node.hub) {
          const ringRadius = 6 + Math.sin(now / 900 + node.x) * 2
          ctx!.strokeStyle = `rgba(${color}, 0.22)`
          ctx!.lineWidth = 1
          ctx!.beginPath()
          ctx!.arc(node.x, node.y, ringRadius, 0, Math.PI * 2)
          ctx!.stroke()
        }
        ctx!.fillStyle = `rgba(${color}, ${twinkle.toFixed(3)})`
        ctx!.beginPath()
        ctx!.arc(node.x, node.y, node.hub ? node.radius + 1.4 : node.radius, 0, Math.PI * 2)
        ctx!.fill()
      }
    }

    frameId = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[-3]" />
}
