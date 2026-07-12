import { BACKGROUND_PHOTOS, SLIDESHOW_INTERVAL_MS } from '../settings/background/slideshow.ts'

/** Каждую минуту плавно кросс-фейдит фон подстанции на случайное следующее фото. */
export function startBackgroundSlideshow(layerA: HTMLElement, layerB: HTMLElement): void {
  let activeLayer: 'a' | 'b' = 'a'
  let lastIndex = 0

  function pickNextIndex(): number {
    let index: number
    do {
      index = Math.floor(Math.random() * BACKGROUND_PHOTOS.length)
    } while (index === lastIndex)
    lastIndex = index
    return index
  }

  setInterval(() => {
    const nextUrl = BACKGROUND_PHOTOS[pickNextIndex()]
    const [incomingLayer, outgoingLayer] = activeLayer === 'a' ? [layerB, layerA] : [layerA, layerB]
    incomingLayer.style.backgroundImage = `url('${nextUrl}')`
    incomingLayer.classList.replace('hidden', 'active')
    outgoingLayer.classList.replace('active', 'hidden')
    activeLayer = activeLayer === 'a' ? 'b' : 'a'
  }, SLIDESHOW_INTERVAL_MS)
}
