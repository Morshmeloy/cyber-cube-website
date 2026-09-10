import { getUser } from './auth.tsx'
import { readTeacherStream } from './teacher-stream.ts'
import type { ChatMessage, Mistake } from '@/components/private/learning/types.tsx'
import { authenticatedFetch } from './http-client.tsx'

const TEACHER_API_BASE = '/api/teacher'
import { historyKey, parseHistory, trimHistory } from './teacher-session.ts'

/** Capture identity at mount: late callbacks must never write under the next user. */
export function teacherHistoryKey(attemptId: string): string {
  return historyKey(getUser()?.username ?? 'anonymous', attemptId)
}

async function teacherFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await authenticatedFetch(`${TEACHER_API_BASE}${path}`, init)
  if (response.ok) return response
  let message = `HTTP ${response.status}`
  try {
    const body = (await response.json()) as { detail?: string }
    if (typeof body.detail === 'string') message = body.detail
    else if (response.status === 422) message = 'Запрос слишком большой или содержит некорректные данные. Начните новый разбор.'
  } catch {
    /* response is not JSON */
  }
  throw new Error(message)
}

// ============================================================================
//  ПОТОКОВЫЕ ФУНКЦИИ (SSE)
// ============================================================================

/**
 * Потоковое объяснение списка ошибок.
 * Для каждого вопроса приходят события с полями id и token.
 * onToken вызывается для каждого токена с соответствующим id вопроса.
 * Возвращает Promise, который разрешается после завершения всего потока.
 */
export async function explainMistakesStream(
  _chatKey: string,
  mistakes: Mistake[],
  onToken: (mistakeId: number, token: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  for (let offset = 0; offset < mistakes.length; offset += 20) {
    signal?.throwIfAborted()
    const response = await teacherFetch('/chat/stream', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mistakes: mistakes.slice(offset, offset + 20) }),
    })
    for await (const event of readTeacherStream(response)) {
      if (event.id !== undefined && event.token !== undefined) {
        onToken(event.id as number, event.token as string)
      } else if (event.all_done) {
        break
      } else if (event.error) {
        throw new Error(event.error as string)
      }
    }
  }
}

/**
 * Потоковое получение подробного объяснения для одного вопроса.
 * Приходят события с полем token.
 * onToken вызывается для каждого токена.
 */
export async function requestMistakeDetailStream(
  _chatKey: string,
  payload: {
    id: number
    question: string
    options: string[]
    correct: number
    correct_answers?: number[]
    selected_answers?: number[]
    previous_explanation: string
    src: string
  },
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await teacherFetch('/chat/detail/stream', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  for await (const event of readTeacherStream(response)) {
    if (event.token !== undefined) {
      onToken(event.token as string)
    } else if (event.done) {
      break
    } else if (event.error) {
      throw new Error(event.error as string)
    }
  }
}

/**
 * Потоковый свободный вопрос.
 * Приходят события с полем token.
 * onToken вызывается для каждого токена.
 */
export async function sendFreeQuestionStream(
  _chatKey: string,
  question: string,
  context: { role: string; content: string }[],
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await teacherFetch('/chat/free/stream', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      context,
    }),
  })
  for await (const event of readTeacherStream(response)) {
    if (event.token !== undefined) {
      onToken(event.token as string)
    } else if (event.done) {
      break
    } else if (event.error) {
      throw new Error(event.error as string)
    }
  }
}

// ============================================================================
//  СИНХРОННЫЕ/ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (для обратной совместимости)
// ============================================================================

/** Проверка статуса модели (не потоковая). */
export interface TeacherModelStatus {
  ready: boolean
  rag_ready: boolean
  model?: string | null
  embedding_model?: string | null
  documents?: number
  detail?: string | null
}

export async function teacherModelStatus(): Promise<TeacherModelStatus> {
  const response = await teacherFetch('/status')
  return response.json() as Promise<TeacherModelStatus>
}

/**
 * Сохраняет готовое сообщение в историю (вызывается после завершения потоковой генерации).
 * Используется компонентом для фиксации ответа в localStorage.
 */
export function commitChatMessage(message: ChatMessage, key: string): void {
  localStorage.setItem(key, JSON.stringify(trimHistory([...loadChatHistory(key), message])))
}

/**
 * Загружает всю историю из localStorage.
 */
export function loadChatHistory(key: string): ChatMessage[] {
  try {
    return parseHistory(localStorage.getItem(key))
  } catch {
    return []
  }
}
