import type { PageBlock } from '../types/page-content.ts'
import {
  CAROUSEL_ITEM_WIDTH_PX,
  CAROUSEL_GAP_PX,
  CAROUSEL_MIN_SCALE,
  CAROUSEL_MIN_OPACITY,
  CAROUSEL_FALLOFF_ITEMS,
  CAROUSEL_TILT_DEG,
} from '../settings/navigation/carousel.ts'

type GalleryImage = Extract<PageBlock, { kind: 'imageGallery' }>['images'][number]

const STEP_PX = CAROUSEL_ITEM_WIDTH_PX + CAROUSEL_GAP_PX

/** Полноэкранный лайтбокс для увеличенного просмотра — один на страницу, старый убирается при пересоздании. */
function createLightbox(): { overlay: HTMLElement; open(src: string, alt: string): void } {
  document.querySelector('.plasma-lightbox')?.remove()

  const overlay = document.createElement('div')
  overlay.className = 'plasma-lightbox'
  const img = document.createElement('img')
  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'plasma-lightbox-close'
  closeButton.setAttribute('aria-label', 'Закрыть')
  closeButton.textContent = '×'
  overlay.append(img, closeButton)
  document.body.appendChild(overlay)

  function hide(): void {
    overlay.classList.remove('active')
  }
  function open(src: string, alt: string): void {
    img.src = src
    img.alt = alt
    overlay.classList.add('active')
  }

  closeButton.addEventListener('click', hide)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hide()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide()
  })

  return { overlay, open }
}

/**
 * Зацикленная 3D-«коверфлоу» карусель сертификатов: активный слайд крупный и по
 * центру, соседние — меньше и с наклоном по обе стороны. Прокрутка колесом,
 * тачем, стрелками или перетаскиванием мышью; клик по боковому слайду
 * приближает его к центру, повторный клик по уже центральному — открывает
 * лайтбокс с увеличенным изображением.
 */
export function createImageCarousel(images: GalleryImage[]): HTMLElement {
  const root = document.createElement('div')
  root.className = 'plasma-carousel'

  const track = document.createElement('div')
  track.className = 'plasma-carousel-track'

  const prevButton = document.createElement('button')
  prevButton.type = 'button'
  prevButton.className = 'plasma-carousel-arrow plasma-carousel-prev'
  prevButton.setAttribute('aria-label', 'Предыдущий сертификат')
  prevButton.innerHTML = '&#10094;'

  const nextButton = document.createElement('button')
  nextButton.type = 'button'
  nextButton.className = 'plasma-carousel-arrow plasma-carousel-next'
  nextButton.setAttribute('aria-label', 'Следующий сертификат')
  nextButton.innerHTML = '&#10095;'

  // Тройной набор слайдов даёт запас с обеих сторон для бесшовной иллюзии зацикленной прокрутки.
  const items: HTMLElement[] = []
  for (let copy = 0; copy < 3; copy++) {
    for (const image of images) {
      const item = document.createElement('div')
      item.className = 'plasma-carousel-item'
      const img = document.createElement('img')
      img.src = image.src
      img.alt = image.alt
      img.loading = 'lazy'
      item.appendChild(img)
      track.appendChild(item)
      items.push(item)
    }
  }

  const lightbox = createLightbox()
  let activeItem: HTMLElement | null = null

  function applyTransforms(): void {
    const trackRect = track.getBoundingClientRect()
    const centerX = trackRect.left + trackRect.width / 2
    let closestItem = items[0]
    let closestDist = Infinity

    for (const item of items) {
      const r = item.getBoundingClientRect()
      const itemCenter = r.left + r.width / 2
      const dist = (itemCenter - centerX) / STEP_PX
      const absDist = Math.min(Math.abs(dist), CAROUSEL_FALLOFF_ITEMS)
      const t = absDist / CAROUSEL_FALLOFF_ITEMS
      const scale = 1 - t * (1 - CAROUSEL_MIN_SCALE)
      const opacity = 1 - t * (1 - CAROUSEL_MIN_OPACITY)
      const tilt = dist === 0 ? 0 : dist > 0 ? -CAROUSEL_TILT_DEG : CAROUSEL_TILT_DEG
      item.style.transform = `perspective(1000px) rotateY(${tilt}deg) scale(${scale})`
      item.style.opacity = String(opacity)
      item.style.zIndex = String(Math.round((1 - t) * 100))
      if (Math.abs(dist) < closestDist) {
        closestDist = Math.abs(dist)
        closestItem = item
      }
    }

    activeItem = closestItem
    for (const item of items) item.classList.toggle('active', item === closestItem)
  }

  // --- Бесшовный цикл: если прокрутка ушла в первую/последнюю копию набора — тихо
  // переносим scrollLeft на эквивалентную позицию в среднем наборе.
  const setWidth = images.length * STEP_PX
  function correctLoop(): void {
    if (track.scrollLeft < setWidth * 0.5) {
      track.scrollLeft += setWidth
    } else if (track.scrollLeft > setWidth * 1.5) {
      track.scrollLeft -= setWidth
    }
  }

  let rafId: number | null = null
  function onScroll(): void {
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      correctLoop()
      applyTransforms()
    })
  }
  track.addEventListener('scroll', onScroll, { passive: true })

  // --- Перетаскивание мышью (тач и колесо уже работают через нативный скролл).
  // move/up повешены на window, а не на track: setPointerCapture на самом track
  // перехватывал бы и последующий click по слайду, ломая клик-по-центру для лайтбокса. ---
  let isPointerDown = false
  let hasDraggedPast = false
  let dragStartX = 0
  let dragStartScroll = 0
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return
    isPointerDown = true
    hasDraggedPast = false
    dragStartX = e.clientX
    dragStartScroll = track.scrollLeft
    track.classList.add('dragging')
  })
  window.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return
    const delta = e.clientX - dragStartX
    if (Math.abs(delta) > 3) hasDraggedPast = true
    track.scrollLeft = dragStartScroll - delta
  })
  function endDrag(): void {
    isPointerDown = false
    track.classList.remove('dragging')
  }
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)

  for (const item of items) {
    item.addEventListener('click', () => {
      if (hasDraggedPast) return
      if (item === activeItem) {
        const img = item.querySelector('img')!
        lightbox.open(img.src, img.alt)
      } else {
        item.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }
    })
  }

  prevButton.addEventListener('click', () => track.scrollBy({ left: -STEP_PX, behavior: 'smooth' }))
  nextButton.addEventListener('click', () => track.scrollBy({ left: STEP_PX, behavior: 'smooth' }))

  root.append(prevButton, track, nextButton)

  // Стартуем со среднего набора, на первом слайде.
  requestAnimationFrame(() => {
    track.scrollLeft = setWidth
    applyTransforms()
  })

  return root
}
