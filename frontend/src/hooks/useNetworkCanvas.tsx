import { useEffect } from 'react'
import type { RefObject } from 'react'

const NODE_COUNT = 46
const MAX_LINK_DIST = 140
const SPEED = 0.15

interface Node {
  x: number
  y: number
  vx: number
  vy: number
}

/**
 * Анимированная сеть узлов на canvas — декоративный слой плазменной панели, по
 * мотивам #networkCanvas из референса «D4NMS» (тема «компьютерные сети»).
 * React-порт бывшего background/network-canvas.ts — хук по образцу useCube,
 * принимает ref канваса вместо отдельно вызываемой функции-стартера.
 */
export function useNetworkCanvas(canvasRef: RefObject<HTMLCanvasElement | null>): void {
  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const ctx: CanvasRenderingContext2D = context

    let width = 0
    let height = 0
    let nodes: Node[] = []
    let frameId: number

    function resize(): void {
      const parent = canvas!.parentElement
      width = parent?.clientWidth ?? window.innerWidth
      height = parent?.clientHeight ?? window.innerHeight
      canvas!.width = width
      canvas!.height = height
    }

    function initNodes(): void {
      nodes = Array.from({ length: NODE_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * SPEED,
        vy: (Math.random() - 0.5) * SPEED,
      }))
    }

    function step(): void {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#00d4ff'
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)'

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
          const dist = Math.hypot(dx, dy)
          if (dist < MAX_LINK_DIST) {
            ctx.globalAlpha = 1 - dist / MAX_LINK_DIST
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }
      ctx.globalAlpha = 1
      for (const node of nodes) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, 1.6, 0, Math.PI * 2)
        ctx.fill()
      }

      frameId = requestAnimationFrame(step)
    }

    resize()
    initNodes()
    step()

    const resizeObserver = new ResizeObserver(() => {
      resize()
      initNodes()
    })
    resizeObserver.observe(canvas.parentElement ?? canvas)

    return () => {
      cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- canvasRef стабилен на весь жизненный цикл
  }, [])
}
