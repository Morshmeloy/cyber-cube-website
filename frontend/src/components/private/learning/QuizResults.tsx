import { useEffect, useState } from 'react'
import type { AnswerState, Mistake, QuestionWithMulti } from './types.tsx'
import { CTA_OUTLINE, CTA_PRIMARY } from './cta.tsx'
import { TeacherChat } from './TeacherChat.tsx'

interface QuizResultsProps {
  total: number
  done: number
  correct: number
  skipped: number
  wrong: number
  pct: number
  mistakes: Mistake[]
  finishedOrder: number[]
  finishedAnswers: Record<number, AnswerState>
  resolveQuestion: (orderIndex: number) => QuestionWithMulti
  canRetryWrong: boolean
  onRestart: () => void
  onRetryWrong: () => void
}

const CIRCUMFERENCE = 314

/** React-порт finishQuiz-рендера + renderFullBreakdown из navigation/learning-quiz.ts —
 * экран результатов: кольцо со счётом, статистика, разбор по вопросам, диалог с учителем. */
export function QuizResults({ total, done, correct, skipped, wrong, pct, mistakes, finishedOrder, finishedAnswers, resolveQuestion, canRetryWrong, onRestart, onRetryWrong }: QuizResultsProps) {
  const [dashOffset, setDashOffset] = useState(CIRCUMFERENCE)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [showChat, setShowChat] = useState(false)

  let title = 'Нужно повторить материал'
  if (pct >= 90) title = 'Отличный результат!'
  else if (pct >= 70) title = 'Хороший результат'
  else if (pct >= 50) title = 'Можно лучше'

  useEffect(() => {
    const id = requestAnimationFrame(() => setDashOffset(CIRCUMFERENCE - (CIRCUMFERENCE * pct) / 100))
    return () => cancelAnimationFrame(id)
  }, [pct])

  return (
    <div className="mx-auto max-w-[640px] text-center">
      <div className="relative mx-auto mb-3.5 h-[140px] w-[140px]">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} />
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke="var(--plasma-color)"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-2xl font-extrabold text-[var(--plasma-color)]">{pct}%</div>
      </div>

      <h2 className="mb-1 text-[clamp(19px,2.6vw,24px)] font-extrabold text-[var(--plasma-color)] [text-shadow:0_0_8px_color-mix(in_srgb,var(--plasma-color)_40%,transparent)]">{title}</h2>
      <p className="text-[13px] text-[#e8f8ff]/60">
        Отвечено: {done} из {total}
      </p>

      <div className="my-4.5 flex flex-wrap justify-center gap-5.5">
        <Stat value={correct} label="Верно" colorClass="text-[#6ee7a0]" />
        <Stat value={wrong} label="Неверно" colorClass="text-[#ff8080]" />
        <Stat value={skipped} label="Пропущено" colorClass="text-[#f0c95f]" />
        <Stat value={total} label="Всего" />
      </div>

      <div className="mt-4.5 flex flex-wrap justify-center gap-2.5">
        <button type="button" onClick={onRestart} className={CTA_PRIMARY}>
          Пройти заново
        </button>
        <button type="button" disabled={!canRetryWrong} onClick={onRetryWrong} className={CTA_OUTLINE}>
          Повторить ошибки
        </button>
        {mistakes.length > 0 && (
          <button type="button" onClick={() => setShowChat((v) => !v)} className={CTA_OUTLINE}>
            🧑‍🏫 Объяснить ошибки
          </button>
        )}
        <button type="button" onClick={() => setShowBreakdown((v) => !v)} className={CTA_OUTLINE}>
          Подробный разбор
        </button>
      </div>

      {showBreakdown && (
        <div
          className="mt-5 rounded-xl border p-4.5 text-left"
          style={{ background: 'color-mix(in srgb, var(--plasma-color) 5%, #14172c)', borderColor: 'color-mix(in srgb, var(--plasma-color) 16%, transparent)' }}
        >
          <h3 className="mb-3.5 text-sm text-[var(--plasma-color)]">Разбор по вопросам</h3>
          {finishedOrder.map((orderIdx, i) => {
            const q = resolveQuestion(i)
            const ans = finishedAnswers[q.id]
            return (
              <div key={orderIdx} className={`py-3.5 ${i > 0 ? 'border-t border-[#e8f8ff]/8' : ''}`}>
                <div className="mb-2.5 flex items-start gap-2.5">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                      ans?.checked ? (ans.correct ? 'bg-[#6ee7a02e] text-[#6ee7a0]' : 'bg-[#ff80802e] text-[#ff9a9a]') : 'bg-[#f0c95f29] text-[#f0c95f]'
                    }`}
                  >
                    {ans?.checked ? (ans.correct ? '✓' : '✗') : '?'}
                  </span>
                  <div className="text-sm leading-relaxed text-[#e8f8ff]">
                    Вопрос {q.id}. {q.q}
                  </div>
                </div>
                <div className="ml-8.5 flex flex-col gap-1 text-[13px]">
                  {q.o.map((opt, oi) => {
                    const isCorrect = q.a.includes(oi)
                    const isSelected = !!ans?.selected.includes(oi)
                    let cls = 'text-[#e8f8ff]/60'
                    if (isCorrect && isSelected) cls = 'text-[#6ee7a0]'
                    else if (isSelected && !isCorrect) cls = 'text-[#ff9a9a]'
                    else if (isCorrect && !isSelected) cls = 'text-[#f0c95f]'
                    return (
                      <div key={oi} className={cls}>
                        {isCorrect && isSelected ? '✓' : isSelected ? '✗' : isCorrect ? '!' : '○'} {opt}
                      </div>
                    )
                  })}
                </div>
                {q.src && <div className="ml-8.5 mt-2 text-xs text-[#e8f8ff]/50">{q.src}</div>}
              </div>
            )
          })}
        </div>
      )}

      {showChat && <TeacherChat mistakes={mistakes} />}
    </div>
  )
}

function Stat({ value, label, colorClass }: { value: number; label: string; colorClass?: string }) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-extrabold ${colorClass ?? 'text-[#e8f8ff]'}`}>{value}</div>
      <div className="mt-0.5 text-xs text-[#e8f8ff]/55">{label}</div>
    </div>
  )
}
