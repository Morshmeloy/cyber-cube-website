import { useEffect, useState } from 'react'
import type { Mode } from './types.tsx'
import { CTA_PRIMARY } from './cta.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'
import { teacherModelStatus } from '@/lib/teacher-api.tsx'

interface QuizStartProps {
  total: number
  multiCount: number
  hasWrongIds: boolean
  onStart: (mode: Mode) => void
}

const modeLabels: Record<Mode, string> = { all: 'Все вопросы', random: 'Случайный порядок', wrong: 'Только ошибки' }

export function QuizStart({ total, multiCount, hasWrongIds, onStart }: QuizStartProps) {
  const [selectedMode, setSelectedMode] = useState<Mode>('all')
  const [isChecking, setIsChecking] = useState(true)
  const [status, setStatus] = useState<{ text: string; variant: 'neutral' | 'ok' | 'error' }>({
    text: 'Проверяем доступность ИИ-помощника…',
    variant: 'neutral',
  })

  useEffect(() => {
    let cancelled = false
    teacherModelStatus()
      .then((data) => {
        if (cancelled) return
        setStatus(
          data.ready && data.rag_ready
            ? { text: `🟢 ИИ-помощник ${data.model ?? ''} и база знаний готовы`, variant: 'ok' }
            : data.ready
              ? { text: `🟡 Модель ${data.model ?? ''} готова, база знаний индексируется`, variant: 'neutral' }
              : { text: '🔴 ИИ-помощник пока недоступен — тест продолжит работать', variant: 'error' },
        )
      })
      .catch(() => {
        if (!cancelled) setStatus({ text: '🔴 Не удалось связаться с ИИ-помощником — тест продолжит работать', variant: 'error' })
      })
      .finally(() => {
        if (!cancelled) setIsChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      className="mx-auto max-w-[640px] rounded-2xl border p-7 text-center"
      style={{ background: 'color-mix(in srgb, var(--plasma-color) 6%, var(--cab-panel-form))', borderColor: 'color-mix(in srgb, var(--plasma-color) 22%, transparent)' }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mx-auto mb-2.5 h-8.5 w-8.5 text-[var(--plasma-color)]"
        style={{ filter: 'drop-shadow(0 0 6px color-mix(in srgb, var(--plasma-color) 60%, transparent))' }}
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      <div
        className="mb-3 inline-block rounded-full border px-3 py-1 text-[12px] font-bold tracking-wide text-[var(--plasma-color)] uppercase"
        style={{ background: 'color-mix(in srgb, var(--plasma-color) 14%, transparent)', borderColor: 'color-mix(in srgb, var(--plasma-color) 35%, transparent)' }}
      >
        Таненбаум, 6-е изд.
      </div>
      <h2 className="mb-2 text-[clamp(20px,3vw,28px)] font-extrabold text-[var(--plasma-color)] [text-shadow:0_0_8px_color-mix(in_srgb,var(--plasma-color)_40%,transparent)]">
        Тест по компьютерным сетям
      </h2>
      <p className="text-sm leading-relaxed text-[var(--cab-text)]/70">
        {total} вопросов по материалам книги{multiCount > 0 ? '. Вопросы с несколькими правильными ответами отмечены значком ⊞' : ''}.
      </p>

      <div className="my-4.5 flex flex-wrap justify-center gap-5.5">
        <div className="text-center">
          <div className="text-2xl font-extrabold text-[var(--plasma-color)] [text-shadow:0_0_8px_color-mix(in_srgb,var(--plasma-color)_50%,transparent)]">{total}</div>
          <div className="mt-0.5 text-xs text-[var(--cab-text)]/55">вопросов</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-extrabold text-[var(--plasma-color)] [text-shadow:0_0_8px_color-mix(in_srgb,var(--plasma-color)_50%,transparent)]">{multiCount}</div>
          <div className="mt-0.5 text-xs text-[var(--cab-text)]/55">мульти-ответов</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-extrabold text-[var(--plasma-color)] [text-shadow:0_0_8px_color-mix(in_srgb,var(--plasma-color)_50%,transparent)]">∞</div>
          <div className="mt-0.5 text-xs text-[var(--cab-text)]/55">попыток</div>
        </div>
      </div>

      <div
        className={`my-3.5 flex items-center justify-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs ${status.variant === 'ok' ? 'text-[var(--cab-success)]' : status.variant === 'error' ? 'text-[var(--cab-danger-text)]' : 'text-[var(--cab-text)]/65'}`}
      >
        {isChecking && <Spinner className="h-3.5 w-3.5" />}
        {status.text}
      </div>

      <div className="my-4.5 text-left">
        <span className="mb-2 block text-xs font-semibold text-[var(--cab-text)]/60">Режим прохождения</span>
        <div className="flex flex-wrap gap-2">
          {(['all', 'random', 'wrong'] as Mode[]).map((mode) => {
            const disabled = mode === 'wrong' && !hasWrongIds
            const isActive = selectedMode === mode
            return (
              <button
                key={mode}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedMode(mode)}
                className={`rounded-lg border px-3.5 py-2 font-inherit text-[14px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  isActive ? 'border-[var(--plasma-color)] text-[var(--plasma-color)]' : 'border-[var(--cab-text)]/20 text-[var(--cab-text)]/80'
                }`}
                style={isActive ? { background: 'color-mix(in srgb, var(--plasma-color) 18%, transparent)' } : { background: 'rgba(5, 5, 16, 0.5)' }}
              >
                {modeLabels[mode]}
              </button>
            )
          })}
        </div>
      </div>

      <button type="button" onClick={() => onStart(selectedMode)} className={`${CTA_PRIMARY} mt-1.5`}>
        Начать тестирование →
      </button>
    </div>
  )
}
