import { forwardRef, useImperativeHandle, useRef } from 'react'
import type { CSSProperties } from 'react'
import { cubeFaceDefinitions, faceColors } from '@/data/navigation/faces.tsx'
import { useLumaKeyCutout } from '@/hooks/useLumaKeyCutout.tsx'
import { LOGO_IMAGE_PATH } from '@/data/site/site.tsx'
import { useCube, type CubeHandle } from '@/hooks/useCube.tsx'
import type { AudioEngine } from '@/types/audio.tsx'
import type { FaceName } from '@/types/navigation.tsx'

export type { CubeHandle }

export type CubeVisualState = 'visible' | 'closing' | 'hidden'

interface CubeProps {
  audio: AudioEngine
  onFaceActivated: (face: FaceName) => void
  canActivateFace: () => boolean
  /** 'visible' — обычный режим; 'closing' — короткая вспышка/сжатие перед тем, как панель
   * страницы полностью откроется (было прямой манипуляцией scene.style в plasma.ts::show());
   * 'hidden' — полностью скрыт (display:none), пока открыта панель. */
  visualState: CubeVisualState
}

/** Визуальные параметры каждой грани — фиксированные брендовые цвета/градиенты (не тема,
 * не должны течь через дизайн-токены), поэтому заданы как данные, а не Tailwind-классы:
 * многостоповые градиенты и 3D-transform с CSS-переменной размера читаемее как объект стилей,
 * чем как одна строка произвольного Tailwind-класса. Альфа-канал background — 0.9 (почти
 * непрозрачно, чуть светлее и лёгкий эффект стекла): полностью прозрачным (альфа < ~0.85)
 * быть не должно — сквозь грань просвечивает фон страницы позади всей сцены куба (грани —
 * это отдельные плоскости без непрозрачной "начинки", не закрытый со всех сторон объём). */
const FACE_VISUALS: Record<FaceName, { background: string; boxShadow: string; transform: string; color: string }> = {
  front: {
    background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.9), rgba(0, 110, 110, 0.9))',
    boxShadow: '0 0 16px rgba(0, 255, 255, 0.25), inset 0 0 24px rgba(0, 255, 255, 0.08)',
    transform: 'translateZ(var(--cube-half))',
    color: faceColors.front,
  },
  back: {
    background: 'linear-gradient(135deg, rgba(255, 0, 255, 0.9), rgba(110, 0, 110, 0.9))',
    boxShadow: '0 0 16px rgba(255, 0, 255, 0.25), inset 0 0 24px rgba(255, 0, 255, 0.08)',
    transform: 'rotateY(180deg) translateZ(var(--cube-half))',
    color: faceColors.back,
  },
  right: {
    background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.9), rgba(0, 110, 60, 0.9))',
    boxShadow: '0 0 16px rgba(0, 255, 136, 0.25), inset 0 0 24px rgba(0, 255, 136, 0.08)',
    transform: 'rotateY(90deg) translateZ(var(--cube-half))',
    color: faceColors.right,
  },
  left: {
    background: 'linear-gradient(135deg, rgba(255, 136, 0, 0.9), rgba(110, 60, 0, 0.9))',
    boxShadow: '0 0 16px rgba(255, 136, 0, 0.25), inset 0 0 24px rgba(255, 136, 0, 0.08)',
    transform: 'rotateY(-90deg) translateZ(var(--cube-half))',
    color: faceColors.left,
  },
  top: {
    background: 'linear-gradient(135deg, rgba(136, 0, 255, 0.9), rgba(60, 0, 110, 0.9))',
    boxShadow: '0 0 16px rgba(136, 0, 255, 0.25), inset 0 0 24px rgba(136, 0, 255, 0.08)',
    transform: 'rotateX(90deg) translateZ(var(--cube-half))',
    color: faceColors.top,
  },
  bottom: {
    background: 'linear-gradient(135deg, rgba(0, 136, 255, 0.9), rgba(0, 60, 110, 0.9))',
    boxShadow: '0 0 16px rgba(0, 136, 255, 0.25), inset 0 0 24px rgba(0, 136, 255, 0.08)',
    transform: 'rotateX(-90deg) translateZ(var(--cube-half))',
    color: faceColors.bottom,
  },
}

const SCENE_STYLE: CSSProperties = {
  '--cube-size': 'clamp(160px, 32vmin, 240px)',
  '--cube-half': 'calc(var(--cube-size) / 2)',
  width: 'var(--cube-size)',
  height: 'var(--cube-size)',
  // Без perspective все translateZ() у граней (FACE_VISUALS) — no-op: грани не
  // расходятся по глубине и складываются друг на друга в одной плоскости, из-за
  // чего несколько полупрозрачных слоёв накладываются и куб выглядит «прозрачным».
  perspective: '900px',
} as CSSProperties

const FACE_ICON_FILTER: CSSProperties = {
  filter: 'drop-shadow(0 0 12px currentColor)',
}

/** Главный 3D-куб навигации — React-порт navigation/cube.ts (см. useCube): та же физика
 * drag/инерции/snap-к-грани и автовращения, но разметка теперь строится через JSX, а не
 * innerHTML-шаблоны, и стили — Tailwind вместо styles/navigation/cube.css. */
export const Cube = forwardRef<CubeHandle, CubeProps>(function Cube({ audio, onFaceActivated, canActivateFace, visualState }, ref) {
  const sceneRef = useRef<HTMLDivElement>(null)
  const cubeRef = useRef<HTMLDivElement>(null)
  const topFaceContentRef = useRef<HTMLAnchorElement>(null)
  const bottomFaceContentRef = useRef<HTMLAnchorElement>(null)
  const frontLogoCanvasRef = useRef<HTMLCanvasElement>(null)

  const handleRef = useCube({
    sceneRef,
    cubeRef,
    topFaceContentRef,
    bottomFaceContentRef,
    audio,
    onFaceActivated,
    canActivateFace,
  })
  useImperativeHandle(ref, () => handleRef.current, [handleRef])

  useLumaKeyCutout(frontLogoCanvasRef, LOGO_IMAGE_PATH)

  return (
    <div
      ref={sceneRef}
      style={SCENE_STYLE}
      className={`absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer select-none ${visualState === 'hidden' ? 'hidden' : ''} ${
        visualState === 'closing'
          ? 'scale-0 rotate-45 opacity-0 transition-all duration-[330ms] ease-[cubic-bezier(0.55,0,0.675,0.19)]'
          : 'scale-100 rotate-0 opacity-100 transition-all duration-500 ease-in-out'
      }`}
    >
      <div ref={cubeRef} className="relative h-full w-full will-change-transform [transform-style:preserve-3d]">
        {cubeFaceDefinitions.map((face) => {
          const visuals = FACE_VISUALS[face.name]
          const isTopOrBottom = face.name === 'top' || face.name === 'bottom'
          return (
            <div
              key={face.name}
              style={{ background: visuals.background, boxShadow: visuals.boxShadow, transform: visuals.transform, color: visuals.color }}
              // Без backdrop-blur: в паре с transform-style:preserve-3d у родителя Chromium
              // некорректно компонует размытие на повёрнутых гранях — собственный
              // background грани будто не рисуется, сквозь неё виден резкий фон страницы.
              className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl border border-white/18 before:absolute before:inset-0 before:rounded-xl before:bg-[inherit] before:opacity-15"
            >
              <a
                href={`#${face.name}`}
                aria-label={face.ariaLabel ?? face.label}
                ref={face.name === 'top' ? topFaceContentRef : face.name === 'bottom' ? bottomFaceContentRef : undefined}
                // Без этого браузер после первого mousemove после mousedown на ссылке
                // запускает нативный drag ссылки (dragstart) и «съедает» все дальнейшие
                // mousemove-события — куб переставал вращаться после первого пикселя драга.
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                // Клик по грани обрабатывается через bubbling на самой сцене (см.
                // onSceneClick в useCube.ts) — она решает, что реально открыть, и сама
                // синхронизирует URL через History API (см. lib/router.ts). Без этого
                // браузер ПАРАЛЛЕЛЬНО ещё и честно переходил по нативному href="#front",
                // приклеивая хэш поверх пути, который только что задал pushState().
                onClick={(e) => e.preventDefault()}
                className={`flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-xl text-inherit no-underline transition-colors duration-300 ${face.name === 'front' ? 'gap-0 p-0' : 'gap-3.5'} ${isTopOrBottom ? '' : ''}`}
              >
                {face.name === 'front' ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <canvas ref={frontLogoCanvasRef} className="mx-auto block h-auto w-[110%]" style={{ filter: 'drop-shadow(0 0 15px rgba(0, 255, 255, 0.9))' }} width={600} height={216} />
                  </div>
                ) : (
                  <div className="h-14 w-14 [&_svg]:h-full [&_svg]:w-full" style={FACE_ICON_FILTER} dangerouslySetInnerHTML={{ __html: face.iconHtml }} />
                )}
                {face.label && <span className="text-center text-[13px] font-bold tracking-[0.12em] uppercase [text-shadow:0_0_10px_currentColor]">{face.label}</span>}
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
})
