import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface GalleryImage {
  src: string
  alt: string
}

const GAP_PX = 24
const GAP_COMPACT_PX = 16
const MIN_SCALE = 0.62
const MIN_OPACITY = 0.35
const FALLOFF_ITEMS = 2.5
const TILT_DEG = 32
const FALLBACK_STEP_PX = 244

const ARROW_CLASS =
  'absolute top-1/2 z-10 flex h-10 w-10 max-sm:h-8.5 max-sm:w-8.5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-[var(--plasma-color,rgba(0,255,255,0.6))] bg-[#050510d9] text-[15px] text-[var(--plasma-color,#0ff)] shadow-[0_0_12px_color-mix(in_srgb,var(--plasma-color,#0ff)_40%,transparent)] transition-transform duration-200 hover:scale-[1.12] hover:shadow-[0_0_20px_color-mix(in_srgb,var(--plasma-color,#0ff)_60%,transparent)] max-sm:text-[13px]'

/**
 * Зацикленная 3D-«коверфлоу» карусель сертификатов — React-порт бывшего
 * navigation/certificate-carousel.ts. Физика скролла/наклона/масштаба соседних
 * слайдов и бесшовный цикл остались императивными (refs + rAF, как в useCube) —
 * это per-frame пересчёт трансформов, useState здесь только тормозил бы. Лайтбокс,
 * наоборот, обычное React-состояние + портал в document.body (там же жил и раньше,
 * вне плазменной панели, поэтому цвет читаем вручную с [data-plasma-panel]).
 */
export function CertificateCarousel({ images }: { images: GalleryImage[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const itemElsRef = useRef<(HTMLDivElement | null)[]>([])
  const hasDraggedPastRef = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [lightboxActive, setLightboxActive] = useState(false)
  const [lightboxColor, setLightboxColor] = useState('')

  const tripled = images.length > 0 ? [...images, ...images, ...images] : []

  useEffect(() => {
    const track = trackRef.current
    if (!track || images.length === 0) return

    let isInteracting = false
    let rafId: number | null = null
    let isPointerDown = false
    let dragStartX = 0
    let dragStartScroll = 0

    const compactQuery = window.matchMedia('(max-width: 640px)')

    function applyCompact(compact: boolean): void {
      track!.style.setProperty('--carousel-item-width', compact ? 'min(72vw, 300px)' : '220px')
      track!.style.gap = `${compact ? GAP_COMPACT_PX : GAP_PX}px`
    }
    applyCompact(compactQuery.matches)

    function measureStepPx(): number {
      const items = itemElsRef.current.filter((el): el is HTMLDivElement => !!el)
      if (items.length < 2) return FALLBACK_STEP_PX
      const a = items[0].getBoundingClientRect()
      const b = items[1].getBoundingClientRect()
      const d = Math.abs(b.left + b.width / 2 - (a.left + a.width / 2))
      return d > 0 ? d : FALLBACK_STEP_PX
    }

    function applyTransforms(): void {
      const stepPx = measureStepPx()
      const trackRect = track!.getBoundingClientRect()
      const centerX = trackRect.left + trackRect.width / 2
      const isCompact = compactQuery.matches
      const falloffItems = isCompact ? 0.45 : FALLOFF_ITEMS
      const minOpacity = isCompact ? 0 : MIN_OPACITY
      const tiltDeg = isCompact ? 0 : TILT_DEG
      let closestIndex = 0
      let closestDist = Infinity

      itemElsRef.current.forEach((item, i) => {
        if (!item) return
        const r = item.getBoundingClientRect()
        const itemCenter = r.left + r.width / 2
        const dist = (itemCenter - centerX) / stepPx
        const absDist = Math.min(Math.abs(dist), falloffItems)
        const t = absDist / falloffItems
        const scale = 1 - t * (1 - MIN_SCALE)
        const opacity = 1 - t * (1 - minOpacity)
        const tiltDist = Math.max(-1, Math.min(1, dist))
        const tilt = -tiltDist * tiltDeg
        item.style.transform = `perspective(1000px) rotateY(${tilt}deg) scale(${scale})`
        item.style.opacity = String(opacity)
        item.style.zIndex = String(Math.round((1 - t) * 100))
        if (Math.abs(dist) < closestDist) {
          closestDist = Math.abs(dist)
          closestIndex = i
        }
      })
      setActiveIndex(closestIndex)
    }

    function correctLoop(): void {
      const stepPx = measureStepPx()
      const setWidth = images.length * stepPx
      if (track!.scrollLeft < setWidth * 0.5) track!.scrollLeft += setWidth
      else if (track!.scrollLeft > setWidth * 1.5) track!.scrollLeft -= setWidth
    }

    function onScroll(): void {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (!isInteracting) correctLoop()
        applyTransforms()
      })
    }
    function onTouchStart(): void {
      isInteracting = true
    }
    function onTouchEnd(): void {
      isInteracting = false
    }
    function onCompactChange(e: MediaQueryListEvent): void {
      applyCompact(e.matches)
      applyTransforms()
    }
    function onPointerDown(e: PointerEvent): void {
      if (e.pointerType !== 'mouse') return
      isPointerDown = true
      isInteracting = true
      hasDraggedPastRef.current = false
      dragStartX = e.clientX
      dragStartScroll = track!.scrollLeft
      setDragging(true)
    }
    function onPointerMove(e: PointerEvent): void {
      if (!isPointerDown) return
      const delta = e.clientX - dragStartX
      if (Math.abs(delta) > 3) hasDraggedPastRef.current = true
      track!.scrollLeft = dragStartScroll - delta
    }
    function endDrag(): void {
      isPointerDown = false
      isInteracting = false
      setDragging(false)
    }

    track.addEventListener('scroll', onScroll, { passive: true })
    track.addEventListener('touchstart', onTouchStart, { passive: true })
    track.addEventListener('touchend', onTouchEnd, { passive: true })
    track.addEventListener('touchcancel', onTouchEnd, { passive: true })
    track.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    compactQuery.addEventListener('change', onCompactChange)

    // Стартуем со среднего набора, на первом слайде.
    const rafInit = requestAnimationFrame(() => {
      track!.scrollLeft = images.length * measureStepPx()
      applyTransforms()
    })

    return () => {
      cancelAnimationFrame(rafInit)
      if (rafId !== null) cancelAnimationFrame(rafId)
      track.removeEventListener('scroll', onScroll)
      track.removeEventListener('touchstart', onTouchStart)
      track.removeEventListener('touchend', onTouchEnd)
      track.removeEventListener('touchcancel', onTouchEnd)
      track.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
      compactQuery.removeEventListener('change', onCompactChange)
    }
  }, [images])

  function scrollByStep(delta: number): void {
    const track = trackRef.current
    if (!track) return
    const items = itemElsRef.current.filter((el): el is HTMLDivElement => !!el)
    let stepPx = FALLBACK_STEP_PX
    if (items.length >= 2) {
      const a = items[0].getBoundingClientRect()
      const b = items[1].getBoundingClientRect()
      stepPx = Math.abs(b.left + b.width / 2 - (a.left + a.width / 2)) || FALLBACK_STEP_PX
    }
    track.scrollBy({ left: delta * stepPx, behavior: 'smooth' })
  }

  function openLightboxAt(index: number): void {
    const panel = document.querySelector<HTMLElement>('[data-plasma-panel]')
    const color = panel ? getComputedStyle(panel).getPropertyValue('--plasma-color').trim() : ''
    setLightboxColor(color)
    setLightboxIndex(index)
    requestAnimationFrame(() => setLightboxActive(true))
  }
  function closeLightbox(): void {
    setLightboxActive(false)
    setTimeout(() => setLightboxIndex(null), 300)
  }
  function stepLightbox(delta: number): void {
    setLightboxIndex((i) => (i === null ? i : (i + delta + images.length) % images.length))
  }

  function handleItemClick(i: number): void {
    if (hasDraggedPastRef.current) return
    if (i === activeIndex) {
      openLightboxAt(i % images.length)
    } else {
      itemElsRef.current[i]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }

  useEffect(() => {
    if (lightboxIndex === null) return
    function onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') closeLightbox()
      else if (e.key === 'ArrowLeft') stepLightbox(-1)
      else if (e.key === 'ArrowRight') stepLightbox(1)
    }
    document.addEventListener('keydown', onKeydown)
    return () => document.removeEventListener('keydown', onKeydown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closeLightbox/stepLightbox стабильны по смыслу, images.length не меняется
  }, [lightboxIndex])

  if (images.length === 0) return null

  return (
    <div className="relative mb-4.5 px-11 max-sm:px-8.5">
      <button type="button" aria-label="Предыдущий сертификат" onClick={() => scrollByStep(-1)} className={`${ARROW_CLASS} left-0`}>
        ‹
      </button>
      <div
        ref={trackRef}
        className={`flex items-center overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scroll-snap-type:x_proximity] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${dragging ? 'cursor-grabbing [scroll-snap-type:none]' : 'cursor-grab'}`}
        style={{ padding: '20px calc(50% - var(--carousel-item-width) / 2)' }}
      >
        {tripled.map((image, i) => (
          <div
            key={i}
            ref={(el) => {
              itemElsRef.current[i] = el
            }}
            onClick={() => handleItemClick(i)}
            className="w-[var(--carousel-item-width)] shrink-0 cursor-pointer [scroll-snap-align:center]"
          >
            <img
              src={image.src}
              alt={image.alt}
              loading="lazy"
              className={`pointer-events-none block h-auto w-full [user-select:none] rounded-[10px] border border-[var(--plasma-color,rgba(0,255,255,0.4))] shadow-[0_0_14px_color-mix(in_srgb,var(--plasma-color,#0ff)_20%,transparent)] transition-shadow duration-200 ${
                i === activeIndex ? 'shadow-[0_0_30px_color-mix(in_srgb,var(--plasma-color,#0ff)_55%,transparent)]' : ''
              }`}
            />
          </div>
        ))}
      </div>
      <button type="button" aria-label="Следующий сертификат" onClick={() => scrollByStep(1)} className={`${ARROW_CLASS} right-0`}>
        ›
      </button>

      {lightboxIndex !== null &&
        createPortal(
          <div
            className={`fixed inset-0 z-[500] flex items-center justify-center bg-[rgba(2,2,8,0.92)] transition-opacity duration-300 ${lightboxActive ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            style={{ '--plasma-color': lightboxColor || undefined } as React.CSSProperties}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeLightbox()
            }}
          >
            <img
              src={images[lightboxIndex].src}
              alt={images[lightboxIndex].alt}
              className={`max-h-[85vh] max-w-[90vw] rounded-[10px] border border-[var(--plasma-color,rgba(0,255,255,0.5))] shadow-[0_0_40px_color-mix(in_srgb,var(--plasma-color,#0ff)_40%,transparent)] transition-transform duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${lightboxActive ? 'scale-100' : 'scale-90'}`}
            />
            <button
              type="button"
              aria-label="Закрыть"
              onClick={closeLightbox}
              className="absolute top-6 right-6 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 border-[var(--plasma-color,rgba(0,255,255,0.6))] bg-[#050510d9] text-[22px] text-[var(--plasma-color,#0ff)] transition-transform duration-200 hover:scale-[1.12] hover:shadow-[0_0_20px_var(--plasma-color,rgba(0,255,255,0.6))]"
            >
              ×
            </button>
            <button
              type="button"
              aria-label="Предыдущий сертификат"
              onClick={() => stepLightbox(-1)}
              className="absolute top-1/2 left-[clamp(8px,3vw,40px)] flex h-13 w-13 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-[var(--plasma-color,rgba(0,255,255,0.6))] bg-[#050510d9] text-lg text-[var(--plasma-color,#0ff)] shadow-[0_0_12px_color-mix(in_srgb,var(--plasma-color,#0ff)_40%,transparent)] transition-transform duration-200 hover:scale-[1.12] hover:shadow-[0_0_20px_color-mix(in_srgb,var(--plasma-color,#0ff)_60%,transparent)]"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Следующий сертификат"
              onClick={() => stepLightbox(1)}
              className="absolute top-1/2 right-[clamp(8px,3vw,40px)] flex h-13 w-13 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-[var(--plasma-color,rgba(0,255,255,0.6))] bg-[#050510d9] text-lg text-[var(--plasma-color,#0ff)] shadow-[0_0_12px_color-mix(in_srgb,var(--plasma-color,#0ff)_40%,transparent)] transition-transform duration-200 hover:scale-[1.12] hover:shadow-[0_0_20px_color-mix(in_srgb,var(--plasma-color,#0ff)_60%,transparent)]"
            >
              ›
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}
