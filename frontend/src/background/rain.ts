import { RAINDROP_COUNT, PURPLE_TRAIL_COUNT } from '../settings/background/rain.ts'

/** Заполняет контейнеры дождя каплями со случайной высотой, скоростью и задержкой. */
export function createRainEffect(rainContainer: HTMLElement, trailContainer: HTMLElement): void {
  for (let i = 0; i < RAINDROP_COUNT; i++) {
    const drop = document.createElement('div')
    drop.className = 'raindrop'
    drop.style.left = `${Math.random() * 100}vw`
    drop.style.height = `${Math.random() * 60 + 40}px`
    drop.style.animationDuration = `${Math.random() * 2 + 2}s`
    drop.style.animationDelay = `${Math.random() * 5}s`
    rainContainer.appendChild(drop)
  }

  for (let i = 0; i < PURPLE_TRAIL_COUNT; i++) {
    const trail = document.createElement('div')
    trail.className = 'purple-trail'
    trail.style.left = `${Math.random() * 100}vw`
    trail.style.height = `${Math.random() * 30 + 20}px`
    trail.style.animationDuration = `${Math.random() * 3 + 2.5}s`
    trail.style.animationDelay = `${Math.random() * 6}s`
    trailContainer.appendChild(trail)
  }
}
