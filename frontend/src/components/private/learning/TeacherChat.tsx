import { useEffect, useRef, useState } from 'react'
import { getData, setData } from '@/lib/storage.tsx'
import type { ChatMessage, Mistake } from './types.tsx'
import { CTA_PRIMARY } from './cta.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'
import {
  teacherHistoryKey,
  explainMistakesStream,
  requestMistakeDetailStream,
  sendFreeQuestionStream,
  commitChatMessage,
  loadChatHistory,
} from '@/lib/teacher-api.tsx'

import { freeQuestionContext } from '@/lib/teacher-session.ts'

const CHAT_DRAFT_KEY = 'learning_chat_draft'

function getErrorMessage(error: unknown, fallback = 'Произошла ошибка.'): string {
  if (error instanceof Error) {
    return error.message || fallback
  }

  if (typeof error === 'string') {
    return error
  }

  return fallback
}

interface TeacherChatProps {
  attemptId: string
  mistakes: Mistake[]
}

/** React-компонент чата с учителем. Поддерживает потоковое получение ответов через SSE.
 *  История сохраняется в localStorage только после завершения генерации каждого сообщения.
 *  Во время генерации ответ отображается по токенам в реальном времени.
 */
export function TeacherChat({ attemptId, mistakes }: TeacherChatProps) {
  const [chatKey] = useState(() => teacherHistoryKey(attemptId))
  const requestRef = useRef<AbortController | null>(null)
  useEffect(() => () => { requestRef.current?.abort() }, [])

  const [history, setHistory] = useState<ChatMessage[]>(() => loadChatHistory(chatKey))

  const [input, setInput] = useState(() => getData<string>(`${CHAT_DRAFT_KEY}:${attemptId}`, ''))
  const [retry, setRetry] = useState(0)
  const [isLoading, setIsLoading] = useState(() => mistakes.some(m => !history.some(h => h.kind === 'explanation' && h.mistakeId === m.id))) // индикатор, что идёт генерация
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null) // сообщение, которое сейчас достраивается
  const [loadingDetailIndex, setLoadingDetailIndex] = useState<number | null>(null)

  const messagesRef = useRef<HTMLDivElement>(null)

  // Первичная загрузка объяснений для ошибок (только если истории нет)
  useEffect(() => {
    const completed = new Set(loadChatHistory(chatKey).filter(m => m.kind === 'explanation').map(m => m.mistakeId))
    const remaining = mistakes.filter(m => !completed.has(m.id))
    if (!remaining.length) return
    const controller = new AbortController()
    requestRef.current = controller

    // Если нет истории, запускаем потоковое объяснение всех ошибок
    let currentMistakeId: number | null = null
    let currentText = ''

    explainMistakesStream(
      chatKey,
      remaining,
      (mistakeId, token) => {
        if (controller.signal.aborted) return
        // Если это новый вопрос, создаём новое сообщение
        if (currentMistakeId !== mistakeId) {
          // Если был предыдущий вопрос – фиксируем его в историю
          if (currentMistakeId !== null && currentText.trim()) {
            const finalMsg: ChatMessage = {
              sender: 'bot',
              text: currentText.trim(),
              contextLabel: `Вопрос ${currentMistakeId}`,
              mistakeId: currentMistakeId,
              kind: 'explanation',
            }
            commitChatMessage(finalMsg, chatKey)
            setHistory(loadChatHistory(chatKey))
          }
          // Начинаем новый ответ
          currentMistakeId = mistakeId
          currentText = ''
          // Создаём временное сообщение для отображения
          const tempMsg: ChatMessage = {
            sender: 'bot',
            text: '',
            contextLabel: `Вопрос ${mistakeId}`,
            mistakeId: mistakeId,
            kind: 'explanation',
          }
          setStreamingMessage(tempMsg)
        }
        // Добавляем токен
        currentText += token
        // Обновляем временное сообщение
        setStreamingMessage((prev) =>
          prev && prev.mistakeId === mistakeId ? { ...prev, text: currentText } : prev,
        )
      },
      controller.signal,
    )
      .then(() => {
        if (controller.signal.aborted) return
        // После завершения потока фиксируем последнее сообщение
        if (currentMistakeId !== null && currentText.trim()) {
          const finalMsg: ChatMessage = {
            sender: 'bot',
            text: currentText.trim(),
            contextLabel: `Вопрос ${currentMistakeId}`,
            mistakeId: currentMistakeId,
            kind: 'explanation',
          }
          commitChatMessage(finalMsg, chatKey)
        }
        // Обновляем историю
        setHistory(loadChatHistory(chatKey))
        setStreamingMessage(null)
        setIsLoading(false)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        console.error(err)
        const errorMsg: ChatMessage = {
          sender: 'bot',
          text: `Ошибка: ${err.message || 'Не удалось получить объяснения.'}`,
          contextLabel: null,
          mistakeId: null,
          kind: 'error',
        }
        commitChatMessage(errorMsg, chatKey)
        setHistory(loadChatHistory(chatKey))
        setStreamingMessage(null)
        setIsLoading(false)
      })
    return () => controller.abort()
  }, [chatKey, mistakes, retry])

  // Прокрутка вниз при добавлении новых сообщений или обновлении потока
  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight })
  }, [history, streamingMessage, isLoading])

  function handleInputChange(value: string): void {
    setInput(value)
    setData(`${CHAT_DRAFT_KEY}:${attemptId}`, value)
  }

  /** Обработчик кнопки "Подробнее" – потоковая генерация доп. объяснения */
  async function handleRequestDetail(mistake: Mistake, previousExplanation: string, index: number): Promise<void> {
    if (isLoading || loadingDetailIndex !== null) return
    const controller = new AbortController()
    requestRef.current = controller
    setIsLoading(true)
    setLoadingDetailIndex(index)
    // Создаём временное сообщение, которое будет достраиваться
    const tempMsg: ChatMessage = {
      sender: 'bot',
      text: '',
      contextLabel: `Вопрос ${mistake.id} · подробнее`,
      mistakeId: mistake.id,
      kind: 'detail',
    }
    setStreamingMessage(tempMsg)
    let accumulated = ''

    try {
      await requestMistakeDetailStream(
        chatKey,
        {
          id: mistake.id,
          question: mistake.question,
          options: mistake.options,
          correct: mistake.correct,
          correct_answers: mistake.correct_answers,
          selected_answers: mistake.selected_answers,
          previous_explanation: previousExplanation.slice(-4000),
          src: mistake.src,
        },
        (token) => {
          accumulated += token
          setStreamingMessage((prev) =>
            prev && prev.mistakeId === mistake.id && prev.kind === 'detail'
              ? { ...prev, text: accumulated }
              : prev,
          )
        },
        controller.signal,
      )
      if (controller.signal.aborted) return
      // После завершения потока фиксируем сообщение в историю
      const finalMsg: ChatMessage = {
        sender: 'bot',
        text: accumulated.trim(),
        contextLabel: `Вопрос ${mistake.id} · подробнее`,
        mistakeId: mistake.id,
        kind: 'detail',
      }
      commitChatMessage(finalMsg, chatKey)
      setHistory(loadChatHistory(chatKey))
      setStreamingMessage(null)
    } catch (err) {
      if (controller.signal.aborted) return
      console.error(err)
      const errorMsg: ChatMessage = {
        sender: 'bot',
        text: `Ошибка: ${getErrorMessage(err, 'Не удалось получить подробное объяснение.')}`,
        contextLabel: null,
        mistakeId: mistake.id,
        kind: 'error',
      }
      commitChatMessage(errorMsg, chatKey)
      setHistory(loadChatHistory(chatKey))
      setStreamingMessage(null)
    } finally {
      setIsLoading(false)
      setLoadingDetailIndex(null)
    }
  }

  /** Обработчик отправки свободного вопроса – потоковая генерация ответа */
  async function handleSendFreeQuestion(): Promise<void> {
    const question = input.trim()
    if (!question || isLoading || loadingDetailIndex !== null) return
    const controller = new AbortController()
    requestRef.current = controller
    const context = freeQuestionContext(history)

    // Сохраняем вопрос пользователя
    const userMsg: ChatMessage = {
      sender: 'user',
      text: question,
      contextLabel: null,
      mistakeId: null,
      kind: 'free',
    }
    commitChatMessage(userMsg, chatKey)
    setHistory(loadChatHistory(chatKey))
    setInput('')
    setData(`${CHAT_DRAFT_KEY}:${attemptId}`, '')

    // Создаём временное сообщение бота
    const tempMsg: ChatMessage = {
      sender: 'bot',
      text: '',
      contextLabel: null,
      mistakeId: null,
      kind: 'free',
    }
    setStreamingMessage(tempMsg)
    setIsLoading(true)

    let accumulated = ''

    try {
      await sendFreeQuestionStream(
        chatKey,
        question,
        context,
        (token) => {
          accumulated += token
          setStreamingMessage((prev) =>
            prev && prev.kind === 'free' ? { ...prev, text: accumulated } : prev,
          )
        },
        controller.signal,
      )
      if (controller.signal.aborted) return
      // Фиксируем готовый ответ
      const finalMsg: ChatMessage = {
        sender: 'bot',
        text: accumulated.trim(),
        contextLabel: null,
        mistakeId: null,
        kind: 'free',
      }
      commitChatMessage(finalMsg, chatKey)
      setHistory(loadChatHistory(chatKey))
      setStreamingMessage(null)
    } catch (err) {
      if (controller.signal.aborted) return
      console.error(err)
      const errorMsg: ChatMessage = {
        sender: 'bot',
        text: `Ошибка: ${getErrorMessage(err, 'Не удалось получить ответ.')}`,
        contextLabel: null,
        mistakeId: null,
        kind: 'error',
      }
      commitChatMessage(errorMsg, chatKey)
      setHistory(loadChatHistory(chatKey))
      setStreamingMessage(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Объединяем историю и потоковое сообщение для отображения
  const displayMessages = [...history]
  if (streamingMessage?.text) displayMessages.push(streamingMessage)

  return (
    <div
      className="mt-5 rounded-xl border p-4.5 text-left"
      style={{ background: 'color-mix(in srgb, var(--plasma-color) 5%, var(--cab-panel))', borderColor: 'color-mix(in srgb, var(--plasma-color) 16%, transparent)' }}
    >
      <h3 className="mb-2.5 text-xs font-bold tracking-wide text-[var(--plasma-color)] uppercase">Ваши ошибки</h3>
      <div className="mb-4 flex flex-col gap-2.5">
        {mistakes.map((m) => (
          <div key={m.id} className="rounded-lg border-l-[3px] border-l-[var(--secondary)] px-3.5 py-2.5" style={{ background: 'color-mix(in srgb, var(--secondary) 6%, rgba(255,255,255,0.04))' }}>
            <div className="mb-1 text-[14px] text-[var(--cab-text)]">{m.question}</div>
            <div className="flex flex-wrap gap-3.5 text-xs text-[var(--cab-text)]/60">
              <span>Ваш ответ: {(m.selected_answers ?? (m.userAnswer === null ? [] : [m.userAnswer])).map(i => m.options[i]).join('; ') || '(не выбрано)'}</span>
              <span className="text-[var(--cab-success)]">Правильный: {(m.correct_answers ?? [m.correct]).map(i => m.options[i]).join('; ')}</span>
            </div>
          </div>
        ))}
      </div>

      <h3 className="mt-5.5 mb-2.5 border-t border-[var(--cab-text)]/10 pt-4.5 text-xs font-bold tracking-wide text-[var(--plasma-color)] uppercase">Диалог с учителем</h3>
      <div ref={messagesRef} className="mb-3.5 flex max-h-[380px] flex-col gap-3 overflow-y-auto pr-1">
        {displayMessages.map((msg, i) => (
          <ChatRow
            key={i}
            msg={msg}
            showDetailButton={
              msg.kind === 'explanation' &&
              !displayMessages.some(
                (h) => h.kind === 'detail' && h.mistakeId === msg.mistakeId ,
              )
            }
            detailLoading={loadingDetailIndex === i}
            busy={isLoading}
            onRequestDetail={() => {
              const mistake = msg.mistakeId !== null ? mistakes.find((m) => m.id === msg.mistakeId) : undefined
              if (mistake) void handleRequestDetail(mistake, msg.text, i)
            }}
          />
        ))}
        {isLoading && !streamingMessage && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--cab-text)]/15 bg-white/5 text-sm">🤖</div>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-[4px] border border-[var(--cab-text)]/10 bg-white/5 px-3.5 py-2.5 text-[14px] text-[var(--cab-text)]/70">
              <Spinner className="h-3.5 w-3.5" />
              Печатает…
            </div>
          </div>
        )}
      </div>

      {!isLoading && mistakes.some(m => !history.some(h => h.kind === 'explanation' && h.mistakeId === m.id)) && (
        <button type="button" className={`${CTA_PRIMARY} mb-3`} onClick={() => { setIsLoading(true); setRetry(value => value + 1) }}>
          Повторить разбор оставшихся ошибок
        </button>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          maxLength={2000}
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSendFreeQuestion()
          }}
          placeholder="Задайте вопрос учителю…"
          className="flex-1 rounded-lg border border-[var(--cab-text)]/20 bg-[var(--cab-field-bg)]/65 px-3 py-2.5 text-[14px] text-[var(--cab-text)] placeholder:text-[var(--cab-text)]/35 focus:border-[var(--plasma-color)] focus:outline-none"
          disabled={isLoading}
        />
        <button type="button" disabled={isLoading || !input.trim()} onClick={() => void handleSendFreeQuestion()} className={`${CTA_PRIMARY} flex items-center gap-1.5`}>
          {isLoading && <Spinner className="h-3.5 w-3.5" />}
          Отправить
        </button>
      </div>
    </div>
  )
}

function ChatRow({
  msg,
  showDetailButton,
  detailLoading,
  busy,
  onRequestDetail,
}: {
  msg: ChatMessage
  showDetailButton: boolean
  detailLoading: boolean
  busy: boolean
  onRequestDetail: () => void
}) {
  const isUser = msg.sender === 'user'
  return (
    <div className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-white/5 text-sm"
        style={{ borderColor: isUser ? 'color-mix(in srgb, var(--plasma-color) 45%, transparent)' : 'rgba(232, 248, 255, 0.15)' }}
      >
        {isUser ? '🧑' : '🤖'}
      </div>
      <div
        className={`max-w-[78%] rounded-2xl border px-3.5 py-2.5 ${isUser ? 'rounded-tr-[4px]' : 'rounded-tl-[4px]'}`}
        style={
          isUser
            ? { background: 'color-mix(in srgb, var(--plasma-color) 14%, transparent)', borderColor: 'color-mix(in srgb, var(--plasma-color) 35%, transparent)' }
            : { background: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(232, 248, 255, 0.1)' }
        }
      >
        {msg.contextLabel && <div className="mb-1 text-[12px] font-bold tracking-wide text-[var(--plasma-color)] uppercase opacity-85">{msg.contextLabel}</div>}
        <div className={`text-[14px] leading-relaxed whitespace-pre-wrap ${isUser ? 'text-[var(--cab-text)]' : 'text-[var(--cab-text)]/90'}`}>{msg.text}</div>
        {showDetailButton && (
          <button
            type="button"
            disabled={detailLoading || busy}
            onClick={onRequestDetail}
            className="mt-2 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] text-[var(--plasma-color)] transition-colors hover:bg-[color-mix(in_srgb,var(--plasma-color)_14%,transparent)] disabled:opacity-60"
            style={{ borderColor: 'color-mix(in srgb, var(--plasma-color) 40%, transparent)' }}
          >
            {detailLoading && <Spinner className="h-3 w-3" />}
            {detailLoading ? 'Загрузка…' : '📖 Подробнее'}
          </button>
        )}
      </div>
    </div>
  )
}