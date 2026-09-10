import type { ChatMessage } from '../components/private/learning/types.tsx'

export function historyKey(username: string, attemptId: string): string {
  return `learning_chat_history:v2:${encodeURIComponent(username)}:${encodeURIComponent(attemptId)}`
}

export function parseHistory(raw: string | null): ChatMessage[] {
  try {
    const value: unknown = JSON.parse(raw || '[]')
    if (!Array.isArray(value)) return []
    return trimHistory(value.filter((m): m is ChatMessage =>
      m && (m.sender === 'bot' || m.sender === 'user') && typeof m.text === 'string' &&
      ['free', 'detail', 'explanation', 'error'].includes(m.kind) &&
      (m.mistakeId === null || Number.isInteger(m.mistakeId)),
    ))
  } catch {
    return []
  }
}

/** Keep completed explanations for the whole 100-question test, plus recent dialogue. */
export function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  const completed = new Set<number | null>()
  let dialogue = 0
  return [...messages].reverse().filter(m => {
    if (m.kind === 'explanation') {
      if (completed.has(m.mistakeId) || completed.size >= 100) return false
      completed.add(m.mistakeId)
      return true
    }
    return ++dialogue <= 40
  }).reverse()
}

/** Only earlier turns of this attempt; the new question is appended by the service. */
export function freeQuestionContext(history: ChatMessage[]): { role: string; content: string }[] {
  return history
    .filter((m) => m.kind === 'free')
    .slice(-6)
    .map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text.slice(-1000),
    }))
}
