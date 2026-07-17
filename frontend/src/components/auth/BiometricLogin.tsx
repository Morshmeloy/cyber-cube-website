import { useEffect, useRef, useState } from 'react'
import { login } from '@/lib/auth.tsx'
import type { PageNavigationTarget } from '@/types/page-content.tsx'

const SCAN_DURATION_MS = 2200
const SUCCESS_DISPLAY_MS = 1100

type Phase = 'scanning' | 'success' | 'logging-in'

interface BiometricLoginProps {
  navigateTo: (target: PageNavigationTarget) => void
  onClose: () => void
}

/** React-порт openBiometricLogin из settings/navigation/pages/auth.ts — заглушка «Вход по
 * биометрии»: включает камеру, изображает сканирование лица и затем ВСЕГДА логинит как admin
 * через тот же login(), без какой-либо реальной привязки к лицу. Поток камеры включается на
 * mount и гарантированно останавливается на unmount/успехе (см. cleanup в useEffect). */
export function BiometricLogin({ navigateTo, onClose }: BiometricLoginProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [phase, setPhase] = useState<Phase>('scanning')
  const [status, setStatus] = useState('Наведите камеру на лицо…')
  const hasCameraSupport = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  const [error, setError] = useState<string | null>(hasCameraSupport ? null : 'Браузер не поддерживает доступ к камере.')

  useEffect(() => {
    if (!hasCameraSupport) return

    let cancelled = false
    let stream: MediaStream | null = null
    let scanTimer: ReturnType<typeof setTimeout> | null = null

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((track) => track.stop())
          return
        }
        stream = s
        if (videoRef.current) videoRef.current.srcObject = stream
        setStatus('Сканирование лица…')
        scanTimer = setTimeout(() => void runSuccess(), SCAN_DURATION_MS)
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось получить доступ к камере — проверьте разрешения браузера.')
      })

    async function runSuccess(): Promise<void> {
      if (cancelled) return
      setPhase('success')
      setStatus('Личность подтверждена ✓')
      stream?.getTracks().forEach((track) => track.stop())
      stream = null

      await new Promise((resolve) => setTimeout(resolve, SUCCESS_DISPLAY_MS))
      if (cancelled) return
      setPhase('logging-in')
      setStatus('Выполняется вход как admin…')

      const result = await login('admin', 'admin')
      if (cancelled) return

      if ('user' in result) {
        onClose()
        navigateTo({ private: 'dashboard' })
        return
      }

      setPhase('scanning')
      setError(result.error === 'server-unreachable' ? 'Сервер авторизации недоступен. Убедитесь, что backend запущен (порт 9000).' : 'Не удалось выполнить демо-вход.')
    }

    return () => {
      cancelled = true
      if (scanTimer) clearTimeout(scanTimer)
      stream?.getTracks().forEach((track) => track.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- navigateTo/onClose стабильны для времени жизни модалки
  }, [])

  useEffect(() => {
    function onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeydown)
    return () => document.removeEventListener('keydown', onKeydown)
  }, [onClose])

  const isSuccess = phase === 'success' || phase === 'logging-in'

  return (
    <div
      className="fixed inset-0 z-[700] flex items-center justify-center bg-[#020208d9] p-5 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="face-login-title" className="relative w-[min(380px,100%)] rounded-2xl border border-cyan-400/40 p-7 text-center shadow-[0_0_30px_rgba(0,255,255,0.3)]" style={{ background: 'linear-gradient(160deg, color-mix(in srgb, #0ff 10%, #171b30) 0%, color-mix(in srgb, #0ff 4%, #11101f) 100%)' }}>
        <button
          type="button"
          aria-label="Закрыть"
          onClick={onClose}
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-[#050510]/60 text-lg text-[#e8f8ff]/80 transition-all hover:scale-110 hover:border-cyan-400"
        >
          &times;
        </button>
        <h3 id="face-login-title" className="mb-4.5 text-base font-bold text-cyan-300 [text-shadow:0_0_6px_rgba(0,255,255,0.5)]">
          Вход по биометрии
        </h3>

        <div className="relative mx-auto mb-4.5 h-[220px] w-[220px] overflow-hidden rounded-full border-2 border-cyan-400/50 bg-[#050510]/60">
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
          {!isSuccess && (
            <div className="absolute -inset-0.5 animate-[faceLoginScan_1.6s_linear_infinite] rounded-full border-2 border-transparent border-t-cyan-300" />
          )}
          <div className={`absolute inset-0 flex items-center justify-center bg-[#05081080] transition-opacity duration-250 ${isSuccess ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
            <svg viewBox="0 0 52 52" className="h-19 w-19">
              <circle
                cx="26"
                cy="26"
                r="24"
                fill="none"
                stroke="#6ee7a0"
                strokeWidth="2"
                strokeDasharray={151}
                strokeDashoffset={isSuccess ? 0 : 151}
                style={{ transition: 'stroke-dashoffset 0.4s ease' }}
              />
              <path
                d="M14 27l7 7 17-17"
                fill="none"
                stroke="#6ee7a0"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={40}
                strokeDashoffset={isSuccess ? 0 : 40}
                style={{ transition: 'stroke-dashoffset 0.3s ease 0.35s' }}
              />
            </svg>
          </div>
        </div>

        <p className="mb-2.5 min-h-[18px] text-sm font-semibold text-cyan-300">{status}</p>
        <p className="text-xs leading-[1.6] text-[#e8f8ff]/60">
          Демо-режим: реального распознавания лица нет. По этой кнопке в любом случае выполняется вход в демонстрационный аккаунт «admin» — без привязки к тому, чьё лицо в кадре.
        </p>
        {error && <p className="mt-3 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2.5 text-xs leading-[1.5] text-red-300">{error}</p>}
      </div>
    </div>
  )
}
