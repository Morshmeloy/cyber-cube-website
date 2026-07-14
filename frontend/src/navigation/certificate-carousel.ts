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

/**
 * Полноэкранный лайтбокс для увеличенного просмотра — один на страницу, старый
 * убирается при пересоздании. Живёт в document.body (а не внутри плазменной
 * панели), поэтому не наследует --plasma-color по CSS-каскаду — цвет крестика
 * и стрелок синхронизируем вручную при каждом открытии, считывая его с текущей
 * .plasma-screen.
 */
function createLightbox(images: GalleryImage[]): { overlay: HTMLElement; open(index: number): void } {
  document.querySelector('.plasma-lightbox')?.remove()

  const overlay = document.createElement('div')
  overlay.className = 'plasma-lightbox'
  const img = document.createElement('img')

  const prevButton = document.createElement('button')
  prevButton.type = 'button'
  prevButton.className = 'plasma-lightbox-arrow plasma-lightbox-prev'
  prevButton.setAttribute('aria-label', 'Предыдущий сертификат')
  prevButton.innerHTML = '&#10094;'

  const nextButton = document.createElement('button')
  nextButton.type = 'button'
  nextButton.className = 'plasma-lightbox-arrow plasma-lightbox-next'
  nextButton.setAttribute('aria-label', 'Следующий сертификат')
  nextButton.innerHTML = '&#10095;'

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'plasma-lightbox-close'
  closeButton.setAttribute('aria-label', 'Закрыть')
  closeButton.textContent = '×'

  overlay.append(img, prevButton, nextButton, closeButton)
  document.body.appendChild(overlay)

  let currentIndex = 0

  function syncColor(): void {
    const screenEl = document.querySelector<HTMLElement>('.plasma-screen')
    const color = screenEl ? getComputedStyle(screenEl).getPropertyValue('--plasma-color').trim() : ''
    if (color) overlay.style.setProperty('--plasma-color', color)
  }

  function render(): void {
    const image = images[currentIndex]
    img.src = image.src
    img.alt = image.alt
  }

  function hide(): void {
    overlay.classList.remove('active')
  }
  function open(index: number): void {
    currentIndex = index
    syncColor()
    render()
    overlay.classList.add('active')
  }
  function step(delta: number): void {
    currentIndex = (currentIndex + delta + images.length) % images.length
    render()
  }

  prevButton.addEventListener('click', () => step(-1))
  nextButton.addEventListener('click', () => step(1))
  closeButton.addEventListener('click', hide)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hide()
  })
  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('active')) return
    if (e.key === 'Escape') hide()
    else if (e.key === 'ArrowLeft') step(-1)
    else if (e.key === 'ArrowRight') step(1)
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

  const lightbox = createLightbox(images)
  let activeItem: HTMLElement | null = null

  // На узких экранах слайды показываются строго по одному — сосед не должен
  // "подглядывать" во время перетаскивания, только у активного нет наклона/затемнения.
  const compactQuery = window.matchMedia('(max-width: 640px)')
  let isCompact = compactQuery.matches
  compactQuery.addEventListener('change', (e) => {
    isCompact = e.matches
    applyTransforms()
  })

  /** Реальное расстояние между центрами соседних слайдов в пикселях — меряем вживую
   * (а не берём из настроек), чтобы работать корректно и при адаптивной ширине слайда. */
  function measureStepPx(): number {
    if (items.length < 2) return STEP_PX
    const a = items[0].getBoundingClientRect()
    const b = items[1].getBoundingClientRect()
    const d = Math.abs(b.left + b.width / 2 - (a.left + a.width / 2))
    return d > 0 ? d : STEP_PX
  }

  function applyTransforms(): void {
    const stepPx = measureStepPx()
    const trackRect = track.getBoundingClientRect()
    const centerX = trackRect.left + trackRect.width / 2
    const falloffItems = isCompact ? 0.45 : CAROUSEL_FALLOFF_ITEMS
    const minOpacity = isCompact ? 0 : CAROUSEL_MIN_OPACITY
    const tiltDeg = isCompact ? 0 : CAROUSEL_TILT_DEG
    let closestItem = items[0]
    let closestDist = Infinity

    for (const item of items) {
      const r = item.getBoundingClientRect()
      const itemCenter = r.left + r.width / 2
      const dist = (itemCenter - centerX) / stepPx
      const absDist = Math.min(Math.abs(dist), falloffItems)
      const t = absDist / falloffItems
      const scale = 1 - t * (1 - CAROUSEL_MIN_SCALE)
      const opacity = 1 - t * (1 - minOpacity)
      // Плавный, пропорциональный расстоянию наклон — а не бинарный "0 или максимум":
      // dist почти никогда не бывает ровно 0 при реальной прокрутке (плавающая точка),
      // из-за чего центральный слайд после первого скролла всегда оказывался наклонён.
      const tiltDist = Math.max(-1, Math.min(1, dist))
      const tilt = -tiltDist * tiltDeg
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
  // переносим scrollLeft на эквивалентную позицию в среднем наборе. Пока палец/кнопка
  // мыши ещё удерживает трек, скачок scrollLeft отложен — иначе он "спорит" с нативным
  // тач-скроллом и выглядит как баг во время самого перетаскивания.
  function correctLoop(): void {
    const stepPx = measureStepPx()
    const setWidth = images.length * stepPx
    if (track.scrollLeft < setWidth * 0.5) {
      track.scrollLeft += setWidth
    } else if (track.scrollLeft > setWidth * 1.5) {
      track.scrollLeft -= setWidth
    }
  }

  let isInteracting = false
  let rafId: number | null = null
  function onScroll(): void {
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      if (!isInteracting) correctLoop()
      applyTransforms()
    })
  }
  track.addEventListener('scroll', onScroll, { passive: true })
  track.addEventListener('touchstart', () => { isInteracting = true }, { passive: true })
  track.addEventListener('touchend', () => { isInteracting = false }, { passive: true })
  track.addEventListener('touchcancel', () => { isInteracting = false }, { passive: true })

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
    isInteracting = true
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
    isInteracting = false
    track.classList.remove('dragging')
  }
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)

  items.forEach((item, i) => {
    item.addEventListener('click', () => {
      if (hasDraggedPast) return
      if (item === activeItem) {
        lightbox.open(i % images.length)
      } else {
        item.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }
    })
  })

  prevButton.addEventListener('click', () => track.scrollBy({ left: -measureStepPx(), behavior: 'smooth' }))
  nextButton.addEventListener('click', () => track.scrollBy({ left: measureStepPx(), behavior: 'smooth' }))

  root.append(prevButton, track, nextButton)

  // Стартуем со среднего набора, на первом слайде.
  requestAnimationFrame(() => {
    track.scrollLeft = images.length * measureStepPx()
    applyTransforms()
  })

  return root
}
