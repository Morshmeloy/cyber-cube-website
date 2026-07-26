import axios from 'axios'
import { getData, setData } from './storage.tsx'
import type { ChatMessage, Mistake } from '@/components/private/learning/types.tsx'

const TEACHER_API_BASE = 'http://localhost:5000'
const CHAT_HISTORY_KEY = 'learning_chat_history'

/**
 * teacher/server.py держит один экземпляр LLM (llama.cpp) на весь процесс — параллельный
 * вызов генерации по двум запросам одновременно ломает внутреннее состояние модели и
 * убивает процесс сервера (GGML_ASSERT ... i1 < ne1, аварийный останов). Бэкенд менять
 * нельзя, поэтому вся защита — здесь: единая последовательная очередь на ВСЕ запросы к
 * teacher/server.py (включая /api/model_status — простой health-check, но безопаснее
 * тоже пускать через очередь, чем распутывать, какие эндпоинты трогают модель, а какие нет).
 *
 * Два правила:
 * 1) Запросы никогда не летят параллельно — каждый следующий стартует только после того,
 *    как предыдущий завершился (успешно или с ошибкой).
 * 2) Если запрос с тем же смысловым ключом (тот же набор вопросов на объяснение, тот же
 *    вопрос на "подробнее", тот же текст свободного вопроса) уже выполняется/стоит в
 *    очереди — повторный вызов не шлёт новый запрос, а просто получает тот же результат.
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

/** Ключ набора вопросов-ошибок — стабильный идентификатор чата, не зависящий от
 * конкретного экземпляра компонента (в отличие от React-state). */
export function mistakesKey(mistakes: Mistake[]): string {
  return mistakes
    .map((m) => m.id)
    .sort((a, b) => a - b)
    .join(',')
}

export function teacherModelStatus(): Promise<{ ready: boolean }> {
  return enqueue('model_status', () => axios.get<{ ready: boolean }>(`${TEACHER_API_BASE}/api/model_status`).then((res) => res.data))
}

export function teacherExplainMistakes(mistakes: Mistake[]): Promise<{ explanations?: { id: number; explanation: string }[]; error?: string }> {
  return enqueue(`chat:${mistakesKey(mistakes)}`, () =>
    axios.post<{ explanations?: { id: number; explanation: string }[]; error?: string }>(`${TEACHER_API_BASE}/api/chat`, { mistakes }).then((res) => res.data),
  )
}

/**
 * «Подробнее» и свободный вопрос — пользовательские одноразовые действия (не
 * перезапускаются автоматически эффектом при каждом монтировании, как /api/chat выше).
 * Раньше их результат дописывался в историю из замыкания того же React-компонента,
 * который их запустил: если пользователь успевал свернуть и развернуть чат (или просто
 * закрыть панель) до ответа сервера, новый экземпляр TeacherChat ничего не знал о ещё
 * идущем запросе — а старый экземпляр, получив ответ, обновлял состояние уже
 * никому не видимого, размонтированного компонента. Индикатор загрузки пропадал, а
 * ответ ИИ, даже дойдя до localStorage, не попадал в state актуального экземпляра.
 *
 * Фикс: запись в историю (localStorage) происходит здесь, на уровне модуля, а не в
 * компоненте — она не зависит от того, жив ли ещё инициировавший запрос компонент.
 * Отдельно — реестр «текущее взаимодействие по набору вопросов» (pendingInteractionByKey),
 * на который свежесмонтированный TeacherChat может подписаться при монтировании, чтобы
 * увидеть индикатор загрузки и досмотреть тот же самый (а не новый) ответ.
 */
const pendingInteractionByKey = new Map<string, Promise<void>>()

export function getPendingInteraction(key: string): Promise<void> | undefined {
  return pendingInteractionByKey.get(key)
}

function trackInteraction(key: string, promise: Promise<void>): Promise<void> {
  pendingInteractionByKey.set(key, promise)
  promise.finally(() => {
    if (pendingInteractionByKey.get(key) === promise) pendingInteractionByKey.delete(key)
  })
  return promise
}

function appendChatMessage(message: ChatMessage): void {
  const current = getData<ChatMessage[]>(CHAT_HISTORY_KEY, [])
  setData(CHAT_HISTORY_KEY, [...current, message])
}

interface ExplainDetailPayload {
  id: number
  question: string
  options: string[]
  correct: number
  previous_explanation: string
  src: string
}

export function requestMistakeDetail(chatKey: string, payload: ExplainDetailPayload): Promise<void> {
  const promise = enqueue(`detail:${payload.id}`, () => axios.post<{ detail?: string; error?: string }>(`${TEACHER_API_BASE}/api/chat/detail`, payload).then((res) => res.data))
    .then((data) => {
      if (data.error || !data.detail) {
        appendChatMessage({ sender: 'bot', text: data.error ?? 'Не удалось получить подробное объяснение.', contextLabel: null, mistakeId: payload.id, kind: 'error' })
        return
      }
      appendChatMessage({ sender: 'bot', text: data.detail, contextLabel: `Вопрос ${payload.id} · подробнее`, mistakeId: payload.id, kind: 'detail' })
    })
    .catch(() => {
      appendChatMessage({ sender: 'bot', text: 'Ошибка соединения с teacher/server.py (порт 5000).', contextLabel: null, mistakeId: payload.id, kind: 'error' })
    })
  return trackInteraction(chatKey, promise)
}

export function sendFreeQuestion(chatKey: string, question: string, context: { role: string; content: string }[]): Promise<void> {
  const promise = enqueue(`free:${question}`, () => axios.post<{ answer?: string; error?: string }>(`${TEACHER_API_BASE}/api/chat/free`, { question, context }).then((res) => res.data))
    .then((data) => {
      if (data.error || !data.answer) {
        appendChatMessage({ sender: 'bot', text: data.error ?? 'Не удалось получить ответ.', contextLabel: null, mistakeId: null, kind: 'error' })
      } else {
        appendChatMessage({ sender: 'bot', text: data.answer, contextLabel: null, mistakeId: null, kind: 'free' })
      }
    })
    .catch(() => {
      appendChatMessage({ sender: 'bot', text: 'Ошибка соединения с teacher/server.py (порт 5000).', contextLabel: null, mistakeId: null, kind: 'error' })
    })
  return trackInteraction(chatKey, promise)
}
