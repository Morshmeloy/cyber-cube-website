/** SSE frames may split anywhere in UTF-8 or use CRLF. EOF is not success. */
export async function* readTeacherStream(response: Response): AsyncGenerator<Record<string, unknown>> {
  if (!response.body) throw new Error('Сервер вернул пустой поток')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let completed = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      if (buffer.length > 1_000_000) throw new Error('Ответ ИИ превышает допустимый размер')
      let match: RegExpExecArray | null
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index)
        buffer = buffer.slice(match.index + match[0].length)
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''))
          .join('\n')
        if (!data) continue
        let event: Record<string, unknown>
        try {
          event = JSON.parse(data)
        } catch {
          throw new Error('Некорректный поток ответа ИИ')
        }
        if (event.error) throw new Error(String(event.error))
        // Per-question done includes id; it does not complete the batch.
        if (event.all_done || (event.done && event.id === undefined)) completed = true
        yield event
      }
      if (done) break
    }
    if (!completed) throw new Error('Ответ ИИ прерван. Повторите запрос.')
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
