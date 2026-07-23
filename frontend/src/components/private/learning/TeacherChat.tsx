import { useEffect, useRef, useState } from 'react'
import { getData, setData } from '@/lib/storage.tsx'
import type { ChatMessage, Mistake } from './types.tsx'
import { CTA_PRIMARY } from './cta.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'
import { mistakesKey, teacherExplainMistakes, requestMistakeDetail, sendFreeQuestion as sendFreeQuestionRequest, getPendingInteraction } from '@/lib/teacher-api.tsx'

const CHAT_HISTORY_KEY = 'learning_chat_history'
const CHAT_DRAFT_KEY = 'learning_chat_draft'

/** История диалога с учителем валидна, только пока набор ошибок тот же — иначе после
 * нового прохождения теста показывался бы разбор для уже неактуальных вопросов. */
function loadChatHistory(mistakes: Mistake[]): ChatMessage[] {
  const stored = getData<ChatMessage[]>(CHAT_HISTORY_KEY, [])
  if (stored.length === 0) return []
  const storedIds = new Set(stored.filter((m): m is ChatMessage & { mistakeId: number } => m.mistakeId !== null).map((m) => m.mistakeId))
  const currentIds = new Set(mistakes.map((m) => m.id))
  const sameSet = storedIds.size === currentIds.size && [...storedIds].every((id) => currentIds.has(id))
  return sameSet ? stored : []
}

interface TeacherChatProps {
  mistakes: Mistake[]
}

/** React-порт openTeacherChat из navigation/learning-quiz.ts — разбор ошибок + свободный
 * диалог с учителем (teacher/server.py). История в localStorage переживает переоткрытие
 * панели, пока набор вопросов-ошибок не изменился. */
export function TeacherChat({ mistakes }: TeacherChatProps) {
  const chatKey = mistakesKey(mistakes)
  const [history, setHistory] = useState<ChatMessage[]>(() => loadChatHistory(mistakes))
  const [input, setInput] = useState(() => getData<string>(CHAT_DRAFT_KEY, ''))
  // Изначально true, если истории ещё нет (эффект ниже сразу запросит объяснения) — либо
  // если на момент монтирования уже есть чужое незавершённое взаимодействие (см. ниже).
  // setLoading(true) внутри эффекта запрещён правилом react-hooks/set-state-in-effect,
  // поэтому оба случая учтены сразу в ленивом инициализаторе.
  const [loading, setLoading] = useState(() => loadChatHistory(mistakes).length === 0 || !!getPendingInteraction(mistakesKey(mistakes)))
  const [loadingDetailIndex, setLoadingDetailIndex] = useState<number | null>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const didFetchInitial = useRef(false)

  function persistHistory(next: ChatMessage[]): void {
    setHistory(next)
    setData(CHAT_HISTORY_KEY, next)
  }

  // Первичная загрузка объяснений — только если истории ещё нет (как в оригинале).
  useEffect(() => {
    if (didFetchInitial.current) return
    didFetchInitial.current = true
    if (history.length > 0) return

    teacherExplainMistakes(mistakes)
      .then((data) => {
        if (data.error || !data.explanations) {
          persistHistory([{ sender: 'bot', text: data.error ?? 'Не удалось получить объяснения.', contextLabel: null, mistakeId: null, kind: 'error' }])
          return
        }
        const next: ChatMessage[] = data.explanations.map((exp) => {
          const mistake = mistakes.find((m) => m.id === exp.id)
          return { sender: 'bot', text: exp.explanation, contextLabel: mistake ? `Вопрос ${mistake.id}` : null, mistakeId: exp.id, kind: 'explanation' }
        })
        persistHistory(next)
      })
      .catch(() => {
        persistHistory([{ sender: 'bot', text: 'Ошибка соединения с teacher/server.py (порт 5000). Проверьте, что сервис запущен.', contextLabel: null, mistakeId: null, kind: 'error' }])
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mistakes стабилен для времени жизни компонента
  }, [])

  // «Подробнее»/свободный вопрос — одноразовые запросы без своего эффекта-перезапуска
  // (см. lib/teacher-api.ts): если пользователь успел свернуть чат и открыть заново, пока
  // ответ ещё генерировался, этот эффект подхватывает уже идущее взаимодействие вместо
  // того, чтобы молча его не заметить — показывает "Печатает…" и дочитывает результат,
  // который teacher-api.ts тем временем допишет в localStorage независимо от того, жив
  // ли инициировавший запрос компонент.
  useEffect(() => {
    const pending = getPendingInteraction(chatKey)
    if (!pending) return
    pending.then(() => setHistory(loadChatHistory(mistakes))).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chatKey/mistakes стабильны для времени жизни компонента
  }, [])

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight })
  }, [history, loading])

  function handleInputChange(value: string): void {
    setInput(value)
    setData(CHAT_DRAFT_KEY, value)
  }

  async function requestDetail(mistake: Mistake, previousExplanation: string, index: number): Promise<void> {
    setLoadingDetailIndex(index)
    try {
      await requestMistakeDetail(chatKey, {
        id: mistake.id,
        question: mistake.question,
        options: mistake.options,
        correct: mistake.correct,
        previous_explanation: previousExplanation,
        src: mistake.src,
      })
      setHistory(loadChatHistory(mistakes))
    } finally {
      setLoadingDetailIndex(null)
    }
  }

  async function sendFreeQuestion(): Promise<void> {
    const question = input.trim()
    if (!question) return
    setInput('')
    setData(CHAT_DRAFT_KEY, '')
    setLoading(true)

    const withUserMsg = [...history, { sender: 'user' as const, text: question, contextLabel: null, mistakeId: null, kind: 'free' as const }]
    persistHistory(withUserMsg)

    const context = withUserMsg
      .filter((m) => m.kind === 'free')
      .slice(-10)
      .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))

    try {
      await sendFreeQuestionRequest(chatKey, question, context)
      setHistory(loadChatHistory(mistakes))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="mt-5 rounded-xl border p-4.5 text-left"
      style={{ background: 'color-mix(in srgb, var(--plasma-color) 5%, #14172c)', borderColor: 'color-mix(in srgb, var(--plasma-color) 16%, transparent)' }}
    >
      <h3 className="mb-2.5 text-xs font-bold tracking-wide text-[var(--plasma-color)] uppercase">Ваши ошибки</h3>
      <div className="mb-4 flex flex-col gap-2.5">
        {mistakes.map((m) => (
          <div key={m.id} className="rounded-lg border-l-[3px] border-l-[var(--secondary)] px-3.5 py-2.5" style={{ background: 'color-mix(in srgb, var(--secondary) 6%, rgba(255,255,255,0.04))' }}>
            <div className="mb-1 text-[13px] text-[#e8f8ff]">{m.question}</div>
            <div className="flex flex-wrap gap-3.5 text-xs text-[#e8f8ff]/60">
              <span>Ваш ответ: {m.userAnswer !== null ? m.options[m.userAnswer] : '(не выбрано)'}</span>
              <span className="text-[#6ee7a0]">Правильный: {m.options[m.correct]}</span>
            </div>
          </div>
        ))}
      </div>

      <h3 className="mt-5.5 mb-2.5 border-t border-[#e8f8ff]/10 pt-4.5 text-xs font-bold tracking-wide text-[var(--plasma-color)] uppercase">Диалог с учителем</h3>
      <div ref={messagesRef} className="mb-3.5 flex max-h-[380px] flex-col gap-3 overflow-y-auto pr-1">
        {history.map((msg, i) => (
          <ChatRow
            key={i}
            msg={msg}
            showDetailButton={msg.kind === 'explanation' && !history.some((h) => h.kind === 'detail' && h.mistakeId === msg.mistakeId)}
            detailLoading={loadingDetailIndex === i}
            onRequestDetail={() => {
              const mistake = msg.mistakeId !== null ? mistakes.find((m) => m.id === msg.mistakeId) : undefined
              if (mistake) void requestDetail(mistake, msg.text, i)
            }}
          />
        ))}
        {loading && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#e8f8ff]/15 bg-white/5 text-sm">🤖</div>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-[4px] border border-[#e8f8ff]/10 bg-white/5 px-3.5 py-2.5 text-[13px] text-[#e8f8ff]/70">
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
            if (e.key === 'Enter') void sendFreeQuestion()
          }}
          placeholder="Задайте вопрос учителю…"
          className="flex-1 rounded-lg border border-[#e8f8ff]/20 bg-[#0a0c18a6] px-3 py-2.5 text-[13px] text-[#e8f8ff] placeholder:text-[#e8f8ff]/35 focus:border-[var(--plasma-color)] focus:outline-none"
        />
        <button type="button" disabled={loading} onClick={() => void sendFreeQuestion()} className={`${CTA_PRIMARY} flex items-center gap-1.5`}>
          {loading && <Spinner className="h-3.5 w-3.5" />}
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
        {msg.contextLabel && <div className="mb-1 text-[11px] font-bold tracking-wide text-[var(--plasma-color)] uppercase opacity-85">{msg.contextLabel}</div>}
        <div className={`text-[13px] leading-relaxed whitespace-pre-wrap ${isUser ? 'text-[#e8f8ff]' : 'text-[#e8f8ff]/90'}`}>{msg.text}</div>
        {showDetailButton && (
          <button
            type="button"
            disabled={detailLoading}
            onClick={onRequestDetail}
            className="mt-2 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] text-[var(--plasma-color)] transition-colors hover:bg-[color-mix(in_srgb,var(--plasma-color)_14%,transparent)] disabled:opacity-60"
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
