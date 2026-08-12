import { useEffect, useRef, useState } from 'react'
import { getData, setData } from '@/lib/storage.tsx'
import type { ChatMessage, Mistake } from './types.tsx'
import { CTA_PRIMARY } from './cta.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'
import {
  mistakesKey,
  explainMistakesStream,
  requestMistakeDetailStream,
  sendFreeQuestionStream,
  commitChatMessage,
  loadChatHistory,
} from '@/lib/teacher-api.tsx'

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

/** Проверка, что сохранённая история соответствует текущему набору ошибок. */
function isHistoryValidForMistakes(history: ChatMessage[], mistakes: Mistake[]): boolean {
  const storedIds = new Set(
    history
      .filter((m): m is ChatMessage & { mistakeId: number } => m.mistakeId !== null)
      .map((m) => m.mistakeId),
  )
  const currentIds = new Set(mistakes.map((m) => m.id))
  return storedIds.size === currentIds.size && [...storedIds].every((id) => currentIds.has(id))
}

interface TeacherChatProps {
  mistakes: Mistake[]
}

/** React-компонент чата с учителем. Поддерживает потоковое получение ответов через SSE.
 *  История сохраняется в localStorage только после завершения генерации каждого сообщения.
 *  Во время генерации ответ отображается по токенам в реальном времени.
 */
export function TeacherChat({ mistakes }: TeacherChatProps) {
  const chatKey = mistakesKey(mistakes)

  // Загружаем историю из localStorage (если она валидна для текущих ошибок)
  const initialHistory = loadChatHistory()
  const [history, setHistory] = useState<ChatMessage[]>(() =>
    isHistoryValidForMistakes(initialHistory, mistakes) ? initialHistory : [],
  )

  const [input, setInput] = useState(() => getData<string>(CHAT_DRAFT_KEY, ''))
  const [isLoading, setIsLoading] = useState(false) // индикатор, что идёт генерация
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null) // сообщение, которое сейчас достраивается
  const [loadingDetailIndex, setLoadingDetailIndex] = useState<number | null>(null)

  const messagesRef = useRef<HTMLDivElement>(null)
  const didFetchInitial = useRef(false)

  // Первичная загрузка объяснений для ошибок (только если истории нет)
  useEffect(() => {
    if (didFetchInitial.current) return
    didFetchInitial.current = true
    if (history.length > 0) return

    // Если нет истории, запускаем потоковое объяснение всех ошибок
    const explanationMessages: ChatMessage[] = []
    let currentMistakeId: number | null = null
    let currentText = ''

    setIsLoading(true)

    explainMistakesStream(
      chatKey,
      mistakes,
      (mistakeId, token) => {
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
            explanationMessages.push(finalMsg)
            commitChatMessage(finalMsg)
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
    )
      .then(() => {
        // После завершения потока фиксируем последнее сообщение
        if (currentMistakeId !== null && currentText.trim()) {
          const finalMsg: ChatMessage = {
            sender: 'bot',
            text: currentText.trim(),
            contextLabel: `Вопрос ${currentMistakeId}`,
            mistakeId: currentMistakeId,
            kind: 'explanation',
          }
          explanationMessages.push(finalMsg)
          commitChatMessage(finalMsg)
        }
        // Обновляем историю
        setHistory(loadChatHistory())
        setStreamingMessage(null)
        setIsLoading(false)
      })
      .catch((err) => {
        console.error(err)
        const errorMsg: ChatMessage = {
          sender: 'bot',
          text: `Ошибка: ${err.message || 'Не удалось получить объяснения.'}`,
          contextLabel: null,
          mistakeId: null,
          kind: 'error',
        }
        commitChatMessage(errorMsg)
        setHistory(loadChatHistory())
        setStreamingMessage(null)
        setIsLoading(false)
      })
  }, [chatKey, history.length, mistakes])

  // Прокрутка вниз при добавлении новых сообщений или обновлении потока
  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight })
  }, [history, streamingMessage, isLoading])

  function handleInputChange(value: string): void {
    setInput(value)
    setData(CHAT_DRAFT_KEY, value)
  }

  /** Обработчик кнопки "Подробнее" – потоковая генерация доп. объяснения */
  async function handleRequestDetail(mistake: Mistake, previousExplanation: string, index: number): Promise<void> {
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
          previous_explanation: previousExplanation,
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
      )
      // После завершения потока фиксируем сообщение в историю
      const finalMsg: ChatMessage = {
        sender: 'bot',
        text: accumulated.trim(),
        contextLabel: `Вопрос ${mistake.id} · подробнее`,
        mistakeId: mistake.id,
        kind: 'detail',
      }
      commitChatMessage(finalMsg)
      setHistory(loadChatHistory())
      setStreamingMessage(null)
    } catch (err) {
      console.error(err)
      const errorMsg: ChatMessage = {
        sender: 'bot',
        text: `Ошибка: ${getErrorMessage(err, 'Не удалось получить подробное объяснение.')}`,
        contextLabel: null,
        mistakeId: mistake.id,
        kind: 'error',
      }
      commitChatMessage(errorMsg)
      setHistory(loadChatHistory())
      setStreamingMessage(null)
    } finally {
      setLoadingDetailIndex(null)
    }
  }

  /** Обработчик отправки свободного вопроса – потоковая генерация ответа */
  async function handleSendFreeQuestion(): Promise<void> {
    const question = input.trim()
    if (!question || isLoading) return

    // Сохраняем вопрос пользователя
    const userMsg: ChatMessage = {
      sender: 'user',
      text: question,
      contextLabel: null,
      mistakeId: null,
      kind: 'free',
    }
    commitChatMessage(userMsg)
    setHistory(loadChatHistory())
    setInput('')
    setData(CHAT_DRAFT_KEY, '')

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

    const context = loadChatHistory()
      .filter((m) => m.kind === 'free' || m.kind === 'explanation')
      .slice(-10)
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }))

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
      )
      // Фиксируем готовый ответ
      const finalMsg: ChatMessage = {
        sender: 'bot',
        text: accumulated.trim(),
        contextLabel: null,
        mistakeId: null,
        kind: 'free',
      }
      commitChatMessage(finalMsg)
      setHistory(loadChatHistory())
      setStreamingMessage(null)
    } catch (err) {
      console.error(err)
      const errorMsg: ChatMessage = {
        sender: 'bot',
        text: `Ошибка: ${getErrorMessage(err, 'Не удалось получить ответ.')}`,
        contextLabel: null,
        mistakeId: null,
        kind: 'error',
      }
      commitChatMessage(errorMsg)
      setHistory(loadChatHistory())
      setStreamingMessage(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Объединяем историю и потоковое сообщение для отображения
  const displayMessages = [...history]
  if (streamingMessage) {
    // Если потоковое сообщение уже есть в истории (например, после перезагрузки) – не дублируем,
    // но в нашем случае оно ещё не закоммичено, поэтому добавляем
    const alreadyExists = displayMessages.some(
      (m) =>
        m.mistakeId === streamingMessage.mistakeId &&
        m.kind === streamingMessage.kind &&
        m.contextLabel === streamingMessage.contextLabel,
    )
    if (!alreadyExists && streamingMessage.text) {
      displayMessages.push(streamingMessage)
    }
  }

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
              <span>Ваш ответ: {m.userAnswer !== null ? m.options[m.userAnswer] : '(не выбрано)'}</span>
              <span className="text-[var(--cab-success)]">Правильный: {m.options[m.correct]}</span>
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
                (h) => h.kind === 'detail' && h.mistakeId === msg.mistakeId && h.contextLabel === msg.contextLabel,
              )
            }
            detailLoading={loadingDetailIndex === i}
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

      <div className="flex gap-2">
        <input
          type="text"
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
  onRequestDetail,
}: {
  msg: ChatMessage
  showDetailButton: boolean
  detailLoading: boolean
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
            disabled={detailLoading}
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