const BACKGROUND_PHOTOS = [
  '/images/fon1.jpg', '/images/fon2.jpg', '/images/fon3.jpg', '/images/fon4.jpg',
  '/images/fon5.jpg', '/images/fon6.jpg', '/images/fon7.jpg', '/images/fon8.jpg',
  '/images/fon9.jpg', '/images/fon10.jpg', '/images/fon11.jpg', '/images/fon12.jpg',
]

const SLIDESHOW_INTERVAL_MS = 60_000

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
