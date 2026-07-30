import { getData, setData } from './storage.tsx'
import type { ChatMessage, Mistake } from '@/components/private/learning/types.tsx'

const TEACHER_API_BASE = 'http://localhost:5000'
const CHAT_HISTORY_KEY = 'learning_chat_history'

/**
 * teacher/server.py держит один экземпляр LLM (llama.cpp) на весь процесс — параллельный
 * вызов генерации по двум запросам одновременно ломает внутреннее состояние модели и
 * убивает процесс сервера. Бэкенд менять нельзя, поэтому вся защита — здесь:
 * единая последовательная очередь на ВСЕ запросы к teacher (кроме model_status,
 * который не трогает модель, но для простоты тоже пускаем через очередь).
 *
 * Два правила:
 * 1) Запросы никогда не летят параллельно — каждый следующий стартует только после того,
 *    как предыдущий завершился (успешно или с ошибкой).
 * 2) Если запрос с тем же смысловым ключом уже выполняется/стоит в очереди —
 *    повторный вызов не шлёт новый запрос, а просто получает тот же результат.
 */
let queueTail: Promise<unknown> = Promise.resolve()
const pendingByKey = new Map<string, Promise<unknown>>()

function enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
  const existing = pendingByKey.get(key)
  if (existing) return existing as Promise<T>

  const run = queueTail.catch(() => {}).then(task)
  queueTail = run.catch(() => {})
  pendingByKey.set(key, run)
  run.finally(() => {
    if (pendingByKey.get(key) === run) pendingByKey.delete(key)
  })
  return run
}

/** Ключ набора вопросов-ошибок — стабильный идентификатор чата. */
export function mistakesKey(mistakes: Mistake[]): string {
  return mistakes
    .map((m) => m.id)
    .sort((a, b) => a - b)
    .join(',')
}

function getUserId(): string {
  try {
    const u = localStorage.getItem('d4_user')
    if (u) {
      const parsed = JSON.parse(u)
      return parsed.username || 'anonymous'
    }
  } catch (_) {}
  return 'anonymous'
}

/** Вспомогательная функция для добавления сообщения в историю (localStorage). */
function appendChatMessage(message: ChatMessage): void {
  const current = getData<ChatMessage[]>(CHAT_HISTORY_KEY, [])
  setData(CHAT_HISTORY_KEY, [...current, message])
}

/**
 * Парсер SSE-потока – возвращает асинхронный генератор объектов,
 * полученных из событий data: {...}.
 */
async function* parseSSE(response: Response): AsyncGenerator<Record<string, unknown>> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim()
        if (jsonStr) {
          try {
            yield JSON.parse(jsonStr)
          } catch (_) {
            // игнорируем битые чанки
          }
        }
      }
    }
  }
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
export function explainMistakesStream(
  chatKey: string,
  mistakes: Mistake[],
  onToken: (mistakeId: number, token: string) => void,
): Promise<void> {
  const key = `explain:${chatKey}`
  return enqueue(key, async () => {
    const response = await fetch(`${TEACHER_API_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mistakes }),
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    for await (const event of parseSSE(response)) {
      if (event.id !== undefined && event.token !== undefined) {
        onToken(event.id as number, event.token as string)
      } else if (event.all_done) {
        break
      } else if (event.error) {
        throw new Error(event.error as string)
      }
    }
  })
}

/**
 * Потоковое получение подробного объяснения для одного вопроса.
 * Приходят события с полем token.
 * onToken вызывается для каждого токена.
 */
export function requestMistakeDetailStream(
  chatKey: string,
  payload: {
    id: number
    question: string
    options: string[]
    correct: number
    previous_explanation: string
    src: string
  },
  onToken: (token: string) => void,
): Promise<void> {
  const key = `detail:${chatKey}:${payload.id}`
  return enqueue(key, async () => {
    const response = await fetch(`${TEACHER_API_BASE}/api/chat/detail/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    for await (const event of parseSSE(response)) {
      if (event.token !== undefined) {
        onToken(event.token as string)
      } else if (event.done) {
        break
      } else if (event.error) {
        throw new Error(event.error as string)
      }
    }
  })
}

/**
 * Потоковый свободный вопрос.
 * Приходят события с полем token.
 * onToken вызывается для каждого токена.
 */
export function sendFreeQuestionStream(
  chatKey: string,
  question: string,
  context: { role: string; content: string }[],
  onToken: (token: string) => void,
): Promise<void> {
  const key = `free:${chatKey}:${question}`
  return enqueue(key, async () => {
    const response = await fetch(`${TEACHER_API_BASE}/api/chat/free/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        context,
        user_id: getUserId(),
      }),
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    for await (const event of parseSSE(response)) {
      if (event.token !== undefined) {
        onToken(event.token as string)
      } else if (event.done) {
        break
      } else if (event.error) {
        throw new Error(event.error as string)
      }
    }
  })
}

// ============================================================================
//  СИНХРОННЫЕ/ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (для обратной совместимости)
// ============================================================================

/** Проверка статуса модели (не потоковая). */
export function teacherModelStatus(): Promise<{ ready: boolean }> {
  return enqueue('model_status', () =>
    fetch(`${TEACHER_API_BASE}/api/model_status`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => data as { ready: boolean }),
  )
}

/**
 * Сохраняет готовое сообщение в историю (вызывается после завершения потоковой генерации).
 * Используется компонентом для фиксации ответа в localStorage.
 */
export function commitChatMessage(message: ChatMessage): void {
  appendChatMessage(message)
}

/**
 * Загружает всю историю из localStorage.
 */
export function loadChatHistory(): ChatMessage[] {
  return getData<ChatMessage[]>(CHAT_HISTORY_KEY, [])
}