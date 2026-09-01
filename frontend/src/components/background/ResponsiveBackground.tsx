import { useEffect, useState } from 'react'

const MOBILE_PORTRAIT_QUERY = '(max-width: 768px) and (orientation: portrait)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean
    addEventListener?: (type: 'change', listener: () => void) => void
    removeEventListener?: (type: 'change', listener: () => void) => void
  }
}

function isDataSaverEnabled(): boolean {
  return (navigator as NavigatorWithConnection).connection?.saveData ?? false
}

interface BackgroundPreferences {
  mobilePortrait: boolean
  reduceMotion: boolean
  saveData: boolean
}

function detectPreferences(): BackgroundPreferences {
  return {
    mobilePortrait: window.matchMedia(MOBILE_PORTRAIT_QUERY).matches,
    reduceMotion: window.matchMedia(REDUCED_MOTION_QUERY).matches,
    saveData: isDataSaverEnabled(),
  }
}

/**
 * Полноценная сцена со скачком энергии перекодирована из 122 кадров animated WebP
 * в H.264: браузер отдаёт её специализированному video-декодеру вместо покадрового
 * декодирования 27-МБ изображения в основном графическом конвейере.
 *
 * На мобильном загружается отдельный вертикальный ролик. Save-Data и системная
 * настройка reduced-motion оставляют только poster — никакое видео не скачивается.
 */
export function ResponsiveBackground() {
  const [preferences, setPreferences] = useState(detectPreferences)

  useEffect(() => {
    const mobilePortrait = window.matchMedia(MOBILE_PORTRAIT_QUERY)
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY)
    const connection = (navigator as NavigatorWithConnection).connection
    const updatePreferences = () => setPreferences(detectPreferences())

    mobilePortrait.addEventListener('change', updatePreferences)
    reducedMotion.addEventListener('change', updatePreferences)
    connection?.addEventListener?.('change', updatePreferences)

    return () => {
      mobilePortrait.removeEventListener('change', updatePreferences)
      reducedMotion.removeEventListener('change', updatePreferences)
      connection?.removeEventListener?.('change', updatePreferences)
    }
  }, [])

  const poster = preferences.mobilePortrait ? '/images/energy_ring_mobile_720x1280.webp' : '/images/energy_ring_poster_1920x1080.webp'
  const video = preferences.mobilePortrait ? '/video/energy_ring_mobile_720x1280.mp4' : '/video/energy_ring_desktop_1920x1080.mp4'
  const animate = !preferences.reduceMotion && !preferences.saveData

  return (
    <div className="pointer-events-none fixed inset-0 z-[-3] select-none" aria-hidden>
      {animate ? (
        <video
          key={video}
          autoPlay
          loop
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
          poster={poster}
          tabIndex={-1}
          className="h-full w-full object-cover"
        >
          <source src={video} type="video/mp4" />
        </video>
      ) : (
        <img src={poster} alt="" decoding="async" fetchPriority="high" className="h-full w-full object-cover" />
      )}
    </div>
  )
}
