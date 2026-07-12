/**
 * Рисует изображение логотипа на canvas и «вырезает» тёмный фон по яркости
 * пикселя (лума-ключ), чтобы логотип светился на неоновом фоне без чёрной
 * подложки. Используется и для логотипа в шапке, и для лицевой грани куба.
 */
const DARK_CUTOFF = 110
const LIGHT_CUTOFF = 180

export interface LumaKeyOptions {
  /** Если true — canvas принимает натуральный размер изображения (для шапки). */
  sizeToImage?: boolean
}

export function applyLumaKeyCutout(canvas: HTMLCanvasElement, imageSrc: string, options: LumaKeyOptions = {}): void {
  const image = new Image()
  image.src = imageSrc
  image.onload = () => {
    if (options.sizeToImage) {
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
    }

    const ctx = canvas.getContext('2d')
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
}
