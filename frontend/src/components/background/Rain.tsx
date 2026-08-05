import { useMemo } from 'react'
import { RAINDROP_COUNT, PURPLE_TRAIL_COUNT } from '@/data/background/rain.tsx'

interface Drop {
  left: number
  height: number
  duration: number
  delay: number
}

function randomDrops(count: number, heightBase: number, heightRange: number, durationBase: number, durationRange: number, delayRange: number): Drop[] {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    height: Math.random() * heightRange + heightBase,
    duration: Math.random() * durationRange + durationBase,
    delay: Math.random() * delayRange,
  }))
}

/**
 * Кибер-дождь — React-порт бывшего background/rain.ts. Раньше капли создавались
 * императивно (document.createElement + appendChild) в два переданных снаружи
 * контейнера; здесь компонент сам владеет обоими слоями и рендерит капли через
 * .map(), со случайными параметрами, посчитанными один раз при монтировании.
 */
export function Rain() {
  // На тач-устройствах (телефоны/планшеты) капель вдвое меньше — рендер такого количества
  // постоянно анимирующихся блюрных теней конкурирует за GPU с вращением куба; на десктопе
  // (курсор мыши) не трогаем.
  const isCoarsePointer = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const raindropCount = isCoarsePointer ? Math.round(RAINDROP_COUNT / 2) : RAINDROP_COUNT
  const purpleTrailCount = isCoarsePointer ? Math.round(PURPLE_TRAIL_COUNT / 2) : PURPLE_TRAIL_COUNT

  const raindrops = useMemo(() => randomDrops(raindropCount, 40, 60, 2, 2, 5), [raindropCount])
  const purpleTrails = useMemo(() => randomDrops(purpleTrailCount, 20, 30, 2.5, 3, 6), [purpleTrailCount])

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
        {raindrops.map((drop, i) => (
          <div
            key={i}
            className="absolute top-[-10%] w-px animate-[fall_linear_infinite] bg-[linear-gradient(transparent,color-mix(in_srgb,var(--primary)_50%,transparent))] opacity-0 shadow-[0_0_6px_color-mix(in_srgb,var(--primary)_40%,transparent)]"
            style={{ left: `${drop.left}vw`, height: `${drop.height}px`, animationDuration: `${drop.duration}s`, animationDelay: `${drop.delay}s` }}
          />
        ))}
      </div>
      <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
        {purpleTrails.map((drop, i) => (
          <div
            key={i}
            className="absolute top-[-5%] w-px animate-[fall_linear_infinite] bg-[linear-gradient(transparent,color-mix(in_srgb,var(--gradient-neon-5)_40%,transparent))] opacity-0 shadow-[0_0_4px_color-mix(in_srgb,var(--gradient-neon-5)_35%,transparent)]"
            style={{ left: `${drop.left}vw`, height: `${drop.height}px`, animationDuration: `${drop.duration}s`, animationDelay: `${drop.delay}s` }}
          />
        ))}
      </div>
    </>
  )
}
