import type { CSSProperties } from 'react'
import type { AnswerState, QuestionWithMulti, QuizState } from './types.tsx'
import { CTA_OUTLINE, CTA_PRIMARY } from './cta.tsx'

interface QuizQuestionProps {
  state: QuizState
  question: QuestionWithMulti
  resolveQuestion: (orderIndex: number) => QuestionWithMulti
  countDone: number
  countCorrect: number
  onToggleOption: (oi: number) => void
  onCheck: () => void
  onNavigate: (dir: number) => void
  onJumpTo: (index: number) => void
  onSkip: () => void
  onFinish: () => void
}

/** React-порт renderQuiz/renderOptions/renderFeedback/renderMap из navigation/learning-quiz.ts —
 * экран прохождения одного вопроса + карта вопросов. */
export function QuizQuestion({ state, question: q, resolveQuestion, countDone, countCorrect, onToggleOption, onCheck, onNavigate, onJumpTo, onSkip, onFinish }: QuizQuestionProps) {
  const total = state.order.length
  const ans: AnswerState | undefined = state.answers[q.id]
  const checked = ans?.checked ?? false

  return (
    <div>
      <header className="mb-2.5 flex flex-wrap items-center justify-between gap-3 max-sm:flex-col max-sm:items-start">
        <div className="text-[15px] font-bold text-[#e8f8ff]">
          Вопрос {state.currentIndex + 1} из {total}
        </div>
        <div className="rounded-full bg-white/5 px-3 py-1.5 text-[13px] text-[#e8f8ff]/70">
          <b className="text-[var(--plasma-color)]">{countCorrect}</b> верно / <b className="text-[var(--plasma-color)]">{countDone}</b> отвечено
        </div>
      </header>

      <div className="mb-4.5 h-[5px] overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full bg-[var(--plasma-color)] shadow-[0_0_8px_var(--plasma-color)] transition-[width] duration-300"
          style={{ width: `${(countDone / total) * 100}%` }}
        />
      </div>

      <div className="mb-4.5 flex items-center justify-between">
        <button type="button" disabled={state.currentIndex === 0} onClick={() => onNavigate(-1)} className={CTA_OUTLINE}>
          ← Назад
        </button>
        <div className="text-[13px] text-[#e8f8ff]/60">
          {state.currentIndex + 1} / {total}
        </div>
        <button type="button" disabled={state.currentIndex === total - 1} onClick={() => onNavigate(1)} className={CTA_OUTLINE}>
          Вперёд →
        </button>
      </div>

      <article
        className="mb-4 rounded-xl border border-l-[3px] p-5"
        style={{
          background: 'color-mix(in srgb, var(--plasma-color) 6%, #171b30)',
          borderColor: 'color-mix(in srgb, var(--plasma-color) 18%, transparent)',
          borderLeftColor: 'var(--secondary)',
        }}
      >
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="text-xs font-bold tracking-wide text-[var(--plasma-color)] uppercase">Вопрос {q.id}</span>
          {q.multi && (
            <span className="rounded-full px-2.5 py-0.5 text-[11px] text-[var(--plasma-color)]" style={{ background: 'color-mix(in srgb, var(--plasma-color) 16%, transparent)' }}>
              ⊞ Несколько ответов
            </span>
          )}
        </div>
        <div className="text-[clamp(15px,2vw,18px)] leading-normal text-[#e8f8ff]">{q.q}</div>
      </article>

      <div className="mb-4.5 flex flex-col gap-2.5">
        {q.o.map((opt, oi) => {
          const isSelected = !!ans?.selected.includes(oi)
          let stateClasses = 'border-[#e8f8ff]/16 bg-white/3'
          if (isSelected) stateClasses = 'border-[var(--plasma-color)]'
          if (checked) {
            const isCorrect = q.a.includes(oi)
            if (isCorrect && isSelected) stateClasses = 'border-[#6ee7a0] bg-[#6ee7a01f]'
            else if (!isCorrect && isSelected) stateClasses = 'border-[#ff8080] bg-[#ff80801f]'
            else if (isCorrect && !isSelected) stateClasses = 'border-[#f0c95f] bg-[#f0c95f1a]'
          }
          return (
            <button
              key={oi}
              type="button"
              disabled={checked}
              onClick={() => onToggleOption(oi)}
              style={isSelected && !checked ? { background: 'color-mix(in srgb, var(--plasma-color) 10%, transparent)' } : undefined}
              className={`flex items-center gap-3 rounded-[10px] border px-4 py-3 text-left font-inherit text-sm text-[#e8f8ff]/90 transition-colors disabled:cursor-default ${stateClasses}`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center border text-xs ${q.multi ? 'rounded-[5px]' : 'rounded-full'} ${
                  isSelected ? 'border-[var(--plasma-color)] text-[var(--plasma-color)]' : 'border-[#e8f8ff]/30'
                }`}
              >
                {isSelected ? '✓' : ''}
              </span>
              <span>{opt}</span>
            </button>
          )
        })}
      </div>

      <div className="mb-4 flex flex-wrap gap-2.5">
        <button type="button" disabled={!ans || ans.selected.length === 0} onClick={onCheck} className={CTA_PRIMARY}>
          Проверить
        </button>
        {checked && (
          <button type="button" onClick={() => onNavigate(1)} className={CTA_OUTLINE}>
            Следующий →
          </button>
        )}
        <button type="button" onClick={onSkip} className={CTA_OUTLINE}>
          Пропустить
        </button>
        <button type="button" onClick={onFinish} className={`${CTA_OUTLINE} ml-auto max-sm:ml-0`}>
          Завершить тест
        </button>
      </div>

      {checked && (
        <div
          className={`mb-5 rounded-[10px] px-4 py-3 text-sm ${
            ans.correct ? 'border border-[#6ee7a059] bg-[#6ee7a01a] text-[#6ee7a0]' : 'border border-[#ff80805a] bg-[#ff80801a] text-[#ff9a9a]'
          }`}
        >
          <div>{ans.correct ? '✓ Правильно!' : `✗ Неверно. Правильный ответ: ${q.a.map((i) => q.o[i]).join('; ')}`}</div>
          {q.src && <div className="mt-2 text-xs text-[#e8f8ff]/60">{q.src}</div>}
        </div>
      )}

      <div className="mb-2 text-xs font-semibold text-[#e8f8ff]/55">Карта вопросов</div>
      <div className="flex flex-wrap gap-1.5">
        {state.order.map((_, i) => {
          const mapQ = resolveQuestion(i)
          const mapAns = state.answers[mapQ.id]
          let dotClasses = 'border-[#e8f8ff]/20 bg-white/3 text-[#e8f8ff]/70'
          let dotStyle: CSSProperties | undefined
          if (i === state.currentIndex) {
            dotStyle = { borderColor: 'var(--plasma-color)', boxShadow: '0 0 8px color-mix(in srgb, var(--plasma-color) 50%, transparent)' }
          } else if (mapAns?.checked) {
            dotClasses = mapAns.correct ? 'border-[#6ee7a066] bg-[#6ee7a029] text-[#6ee7a0]' : 'border-[#ff808066] bg-[#ff808029] text-[#ff9a9a]'
          } else if (mapAns?.skipped) {
            dotClasses = 'border-[#f0c95f66] bg-[#f0c95f24] text-[#f0c95f]'
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => onJumpTo(i)}
              style={dotStyle}
              className={`h-7.5 w-7.5 cursor-pointer rounded-[7px] border text-xs ${dotClasses}`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}
