import { useEffect, useRef, useState } from 'react'
import { BACKGROUND_PHOTOS, SLIDESHOW_INTERVAL_MS } from '@/data/background/slideshow.tsx'

/**
 * Фоновая подложка «электроподстанция» — React-порт бывшего
 * background/background-slideshow.ts (стили — Tailwind вместо отдельного CSS).
 * Раньше компонент выше (AppRoot) передавал сюда два ref'а на свои <div>; теперь
 * оба слоя и кросс-фейд между ними полностью внутри этого компонента.
 */
export function BackgroundSlideshow() {
  const [activeLayer, setActiveLayer] = useState<'a' | 'b'>('a')
  const [urlA, setUrlA] = useState(BACKGROUND_PHOTOS[0])
  const [urlB, setUrlB] = useState<string | null>(null)
  const lastIndexRef = useRef(0)

  useEffect(() => {
    const id = setInterval(() => {
      let index: number
      do {
        index = Math.floor(Math.random() * BACKGROUND_PHOTOS.length)
      } while (index === lastIndexRef.current)
      lastIndexRef.current = index

      const nextUrl = BACKGROUND_PHOTOS[index]
      setActiveLayer((prev) => {
        if (prev === 'a') {
          setUrlB(nextUrl)
          return 'b'
        }
        setUrlA(nextUrl)
        return 'a'
      })
    }, SLIDESHOW_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="fixed inset-0 z-[-3] overflow-hidden">
      <div
        className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-[2000ms] ease-in-out ${activeLayer === 'a' ? 'opacity-100' : 'opacity-0'}`}
        style={{ backgroundImage: `url('${urlA}')` }}
      />
      <div
        className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-[2000ms] ease-in-out ${activeLayer === 'b' ? 'opacity-100' : 'opacity-0'}`}
        style={{ backgroundImage: urlB ? `url('${urlB}')` : undefined }}
      />
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--gradient-neon-2) 25%, transparent) 0%, color-mix(in srgb, var(--gradient-neon-5) 20%, transparent) 50%, color-mix(in srgb, var(--primary) 25%, transparent) 100%)',
        }}
      />
      <div
        className="absolute inset-0 z-[2] animate-[neonPulseBg_4s_ease-in-out_infinite_alternate] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 20% 30%, color-mix(in srgb, var(--gradient-neon-2) 30%, transparent) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, color-mix(in srgb, var(--primary) 30%, transparent) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, color-mix(in srgb, var(--gradient-neon-5) 20%, transparent) 0%, transparent 60%)',
        }}
      />
    </div>
  )
}
