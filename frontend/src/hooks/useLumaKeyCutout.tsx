import { useEffect } from 'react'
import type { RefObject } from 'react'
import { DARK_CUTOFF, LIGHT_CUTOFF } from '@/data/background/luma-key.tsx'

export interface LumaKeyOptions {
  /** Если true — canvas принимает натуральный размер изображения (для шапки). */
  sizeToImage?: boolean
}

/**
 * Рисует изображение логотипа на canvas и «вырезает» тёмный фон по яркости
 * пикселя (лума-ключ), чтобы логотип светился на неоновом фоне без чёрной
 * подложки. React-порт бывшего background/logo-luma-key.ts — хук по образцу
 * useCube, принимает ref канваса вместо того, чтобы вызывать функцию вручную
 * внутри useEffect на стороне компонента.
 */
export function useLumaKeyCutout(canvasRef: RefObject<HTMLCanvasElement | null>, imageSrc: string, options: LumaKeyOptions = {}): void {
  const sizeToImage = options.sizeToImage ?? false

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const image = new Image()
    image.src = imageSrc
    image.onload = () => {
      if (sizeToImage) {
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
      }

      // Хук сразу читает пиксели через getImageData; явный флаг позволяет браузеру
      // выбрать подходящий backing store и убирает Canvas2D performance warning.
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const pixels = imageData.data
        for (let i = 0; i < pixels.length; i += 4) {
          const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3
          if (brightness < DARK_CUTOFF) {
            pixels[i + 3] = 0
          } else if (brightness < LIGHT_CUTOFF) {
            pixels[i + 3] = Math.round(((brightness - DARK_CUTOFF) / (LIGHT_CUTOFF - DARK_CUTOFF)) * 255)
          }
        }
        ctx.putImageData(imageData, 0, 0)
      } catch {
        // getImageData может падать при открытии страницы напрямую с file:// — просто оставляем как есть.
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- canvasRef стабилен, imageSrc/sizeToImage не меняются в течение жизни компонента
  }, [imageSrc, sizeToImage])
}
