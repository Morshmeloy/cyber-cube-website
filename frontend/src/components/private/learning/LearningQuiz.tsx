import { useState } from 'react'
import { LEARNING_QUESTIONS, type LearningQuestion } from '@/data/navigation/pages/private/learning-questions.tsx'
import { getData, setData } from '@/lib/storage.tsx'
import { QuizStart } from './QuizStart.tsx'
import { QuizQuestion } from './QuizQuestion.tsx'
import { QuizResults } from './QuizResults.tsx'
import { emptyQuizState, type AnswerState, type Mistake, type Mode, type QuestionWithMulti, type QuizState } from './types.tsx'

const QUESTIONS: QuestionWithMulti[] = LEARNING_QUESTIONS.map((q) => ({ ...q, multi: q.a.length > 1 }))
const PROGRESS_KEY = 'learning_progress'

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

interface FinishedResults {
  total: number
  done: number
  correct: number
  skipped: number
  wrong: number
  pct: number
  mistakes: Mistake[]
  finishedOrder: number[]
  finishedAnswers: Record<number, AnswerState>
}

/** React-порт navigation/learning-quiz.ts::createLearningQuiz — тест по книге Таненбаума
 * «Компьютерные сети». Логика (режимы прохождения, снимок ошибок для повтора, снимок
 * результата для разбора до сброса прогресса) не менялась, состояние — React вместо
 * прямых мутаций объекта + ручного render(). */
export function LearningQuiz() {
  const [state, setState] = useState<QuizState>(() => getData<QuizState>(PROGRESS_KEY, emptyQuizState()))
  const [wrongIds, setWrongIds] = useState<number[]>([])
  const [results, setResults] = useState<FinishedResults | null>(null)

  function save(next: QuizState): void {
    setState(next)
    setData(PROGRESS_KEY, next)
  }

  function countDone(s: QuizState): number {
    return Object.values(s.answers).filter((a) => a.checked).length
  }
  function countCorrect(s: QuizState): number {
    return Object.values(s.answers).filter((a) => a.checked && a.correct).length
  }
  function resolveQuestion(orderIndex: number): QuestionWithMulti {
    return QUESTIONS[state.order[orderIndex]]
  }
  function resolveFinishedQuestion(order: number[], orderIndex: number): QuestionWithMulti {
    return QUESTIONS[order[orderIndex]]
  }

  function startQuiz(mode: Mode): void {
    const indices = QUESTIONS.map((_, i) => i)
    let order: number[]
    if (mode === 'random') order = shuffle(indices)
    else if (mode === 'wrong') order = wrongIds.length > 0 ? [...wrongIds] : indices
    else order = indices

    save({ mode, order, currentIndex: 0, answers: {} })
    setResults(null)
  }

  function toggleOption(q: QuestionWithMulti, oi: number): void {
    const existing = state.answers[q.id]
    if (existing?.checked) return
    const ans: AnswerState = existing ? { ...existing, selected: [...existing.selected] } : { selected: [], checked: false, correct: false }
    if (q.multi) {
      const idx = ans.selected.indexOf(oi)
      if (idx === -1) ans.selected.push(oi)
      else ans.selected.splice(idx, 1)
    } else {
      ans.selected = [oi]
    }
    save({ ...state, answers: { ...state.answers, [q.id]: ans } })
  }

  function checkAnswer(): void {
    const q = resolveQuestion(state.currentIndex)
    const ans = q && state.answers[q.id]
    if (!q || !ans || ans.selected.length === 0) return
    const selectedSorted = [...ans.selected].sort().join(',')
    const correctSorted = [...q.a].sort().join(',')
    const nextAns: AnswerState = { ...ans, checked: true, correct: selectedSorted === correctSorted }
    save({ ...state, answers: { ...state.answers, [q.id]: nextAns } })
  }

  function navigate(dir: number): void {
    const idx = state.currentIndex + dir
    if (idx < 0 || idx >= state.order.length) return
    save({ ...state, currentIndex: idx })
  }

  function jumpTo(index: number): void {
    save({ ...state, currentIndex: index })
  }

  function skipQuestion(): void {
    const q = resolveQuestion(state.currentIndex)
    if (q && !state.answers[q.id]) {
      const nextState = { ...state, answers: { ...state.answers, [q.id]: { selected: [], checked: false, correct: false, skipped: true } } }
      const idx = nextState.currentIndex + 1
      if (idx < 0 || idx >= nextState.order.length) {
        save(nextState)
        return
      }
      save({ ...nextState, currentIndex: idx })
      return
    }
    navigate(1)
  }

  function finishQuiz(): void {
    const total = state.order.length
    const done = countDone(state)
    const correct = countCorrect(state)
    const skipped = total - done
    const wrong = done - correct

    const nextWrongIds: number[] = []
    const mistakes: Mistake[] = []
    for (const qIdx of state.order) {
      const q = QUESTIONS[qIdx]
      const ans = state.answers[q.id]
      if (ans?.checked && !ans.correct) {
        nextWrongIds.push(qIdx)
        mistakes.push({ id: q.id, question: q.q, options: q.o, correct: q.a[0], userAnswer: ans.selected[0] ?? null, src: q.src })
      }
    }
    setWrongIds(nextWrongIds)

    const pct = total > 0 ? Math.round((correct / total) * 100) : 0

    // Снимок прошедшего теста — берём до сброса progress, разбор показывается по нему.
    setResults({ total, done, correct, skipped, wrong, pct, mistakes, finishedOrder: [...state.order], finishedAnswers: { ...state.answers } })
    setData(PROGRESS_KEY, emptyQuizState())
    setState(emptyQuizState())
  }

  function restart(): void {
    setResults(null)
  }

  const total = QUESTIONS.length
  const multiCount = QUESTIONS.filter((q) => q.multi).length

  if (results) {
    return (
      <QuizResults
        {...results}
        resolveQuestion={(i) => resolveFinishedQuestion(results.finishedOrder, i)}
        canRetryWrong={wrongIds.length > 0}
        onRestart={restart}
        onRetryWrong={() => startQuiz('wrong')}
      />
    )
  }

  if (state.order.length === 0) {
    return <QuizStart total={total} multiCount={multiCount} hasWrongIds={wrongIds.length > 0} onStart={startQuiz} />
  }

  const q = resolveQuestion(state.currentIndex)
  if (!q) return <QuizStart total={total} multiCount={multiCount} hasWrongIds={wrongIds.length > 0} onStart={startQuiz} />

  return (
    <div className="relative flex flex-col">
      <div
        className="pointer-events-none absolute -inset-6 -z-10"
        style={{
          backgroundImage:
            'linear-gradient(90deg, color-mix(in srgb, var(--plasma-color) 10%, transparent) 1px, transparent 1px), linear-gradient(color-mix(in srgb, var(--plasma-color) 10%, transparent) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, black 30%, transparent 75%)',
        }}
      />
      <QuizQuestion
        state={state}
        question={q}
        resolveQuestion={resolveQuestion}
        countDone={countDone(state)}
        countCorrect={countCorrect(state)}
        onToggleOption={(oi) => toggleOption(q, oi)}
        onCheck={checkAnswer}
        onNavigate={navigate}
        onJumpTo={jumpTo}
        onSkip={skipQuestion}
        onFinish={finishQuiz}
      />
    </div>
  )
}

export type { LearningQuestion }
