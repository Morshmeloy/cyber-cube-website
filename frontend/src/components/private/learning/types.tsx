import type { LearningQuestion } from '@/data/navigation/pages/private/learning-questions.tsx'

export type Mode = 'all' | 'random' | 'wrong'

export interface AnswerState {
  selected: number[]
  checked: boolean
  correct: boolean
  skipped?: boolean
}

export interface QuizState {
  mode: Mode
  order: number[]
  currentIndex: number
  answers: Record<number, AnswerState>
}

export interface Mistake {
  id: number
  question: string
  options: string[]
  correct: number
  userAnswer: number | null
  src: string
}

export interface ChatMessage {
  sender: 'user' | 'bot'
  text: string
  /** Короткая метка над сообщением («Вопрос 3», «Вопрос 3 · подробнее») — чтобы не
   * повторять весь текст вопроса внутри пузыря сплошным абзацем, его и так видно
   * в списке ошибок сверху; здесь нужна только привязка «это объяснение к чему». */
  contextLabel: string | null
  mistakeId: number | null
  kind: 'explanation' | 'detail' | 'free' | 'error'
}

export type QuestionWithMulti = LearningQuestion & { multi: boolean }

export function emptyQuizState(): QuizState {
  return { mode: 'all', order: [], currentIndex: 0, answers: {} }
}
