import { LEARNING_QUESTIONS, type LearningQuestion } from '../settings/navigation/pages/private/learning-questions.ts'
import { getData, setData } from '../lib/storage.ts'

/** Сервис teacher/server.py (Flask + LLM + ChromaDB) — отдельный процесс на порту 5000,
 * не связан с бэкендом авторизации (порт 9000, см. lib/auth.ts). */
const TEACHER_API_BASE = 'http://localhost:5000'

type Mode = 'all' | 'random' | 'wrong'

interface AnswerState {
  selected: number[]
  checked: boolean
  correct: boolean
  skipped?: boolean
}

interface QuizState {
  mode: Mode
  order: number[]
  currentIndex: number
  answers: Record<number, AnswerState>
}

interface Mistake {
  id: number
  question: string
  options: string[]
  correct: number
  userAnswer: number | null
  src: string
}

interface ChatMessage {
  sender: 'user' | 'bot'
  text: string
  /** Короткая метка над сообщением («Вопрос 3», «Вопрос 3 · подробнее») — чтобы не
   * повторять весь текст вопроса внутри пузыря сплошным абзацем, его и так видно
   * в списке ошибок сверху; здесь нужна только привязка «это объяснение к чему». */
  contextLabel: string | null
  mistakeId: number | null
  kind: 'explanation' | 'detail' | 'free' | 'error'
}

const QUESTIONS: (LearningQuestion & { multi: boolean })[] = LEARNING_QUESTIONS.map((q) => ({ ...q, multi: q.a.length > 1 }))
const PROGRESS_KEY = 'learning_progress'
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

function emptyState(): QuizState {
  return { mode: 'all', order: [], currentIndex: 0, answers: {} }
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Тест по книге Таненбаума «Компьютерные сети» — своя вёрстка в стиле сайта, данные вопросов
 * перенесены из teacher/questions.js, а объяснения ошибок запрашиваются напрямую у teacher/server.py
 * (POST /api/chat, /api/chat/detail). Это не тот же UI, что у teacher/quiz.js — переписано заново
 * под неоновую эстетику плазменной панели, но повторяет тот же сценарий прохождения теста. */
export function createLearningQuiz(): HTMLElement {
  const root = document.createElement('div')
  root.className = 'lq-root'

  let state: QuizState = getData<QuizState>(PROGRESS_KEY, emptyState())
  let wrongIds: number[] = []

  function save(): void {
    setData(PROGRESS_KEY, state)
  }

  function countDone(): number {
    return Object.values(state.answers).filter((a) => a.checked).length
  }
  function countCorrect(): number {
    return Object.values(state.answers).filter((a) => a.checked && a.correct).length
  }
  function currentQuestion(): (LearningQuestion & { multi: boolean }) | undefined {
    return QUESTIONS[state.order[state.currentIndex]]
  }

  // --- Стартовый экран -----------------------------------------------------
  function renderStart(): void {
    root.innerHTML = ''
    const total = QUESTIONS.length
    const multiCount = QUESTIONS.filter((q) => q.multi).length

    const wrap = document.createElement('div')
    wrap.className = 'lq-start'
    wrap.innerHTML = `
      <svg class="lq-network-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      <div class="lq-start-badge">Таненбаум, 6-е изд.</div>
      <h2 class="lq-start-title">Тест по компьютерным сетям</h2>
      <p class="lq-start-desc">${total} вопросов по материалам книги${multiCount > 0 ? '. Вопросы с несколькими правильными ответами отмечены значком ⊞' : ''}.</p>
      <div class="lq-stats">
        <div class="lq-stat"><div class="lq-stat-num">${total}</div><div class="lq-stat-label">вопросов</div></div>
        <div class="lq-stat"><div class="lq-stat-num">${multiCount}</div><div class="lq-stat-label">мульти-ответов</div></div>
        <div class="lq-stat"><div class="lq-stat-num">∞</div><div class="lq-stat-label">попыток</div></div>
      </div>
      <div class="lq-model-status" id="lq-model-status">Проверяем доступность ИИ-помощника…</div>
      <div class="lq-mode-select">
        <span class="lq-mode-label">Режим прохождения</span>
        <div class="lq-mode-btns">
          <button type="button" class="lq-mode-btn active" data-mode="all">Все вопросы</button>
          <button type="button" class="lq-mode-btn" data-mode="random">Случайный порядок</button>
          <button type="button" class="lq-mode-btn" data-mode="wrong" ${wrongIds.length === 0 ? 'disabled' : ''}>Только ошибки</button>
        </div>
      </div>
      <button type="button" class="plasma-cta plasma-cta-primary lq-start-btn">Начать тестирование →</button>
    `
    root.appendChild(wrap)

    let selectedMode: Mode = 'all'
    const modeBtns = wrap.querySelectorAll<HTMLButtonElement>('.lq-mode-btn')
    modeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        modeBtns.forEach((b) => b.classList.remove('active'))
        btn.classList.add('active')
        selectedMode = btn.dataset.mode as Mode
      })
    })
    wrap.querySelector<HTMLButtonElement>('.lq-start-btn')!.addEventListener('click', () => startQuiz(selectedMode))

    checkModelStatus(wrap.querySelector('#lq-model-status')!)
  }

  async function checkModelStatus(el: HTMLElement): Promise<void> {
    try {
      const res = await fetch(`${TEACHER_API_BASE}/api/model_status`)
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { ready: boolean }
      el.textContent = data.ready ? '🟢 ИИ-помощник готов объяснять ошибки' : '🟡 ИИ-помощник ещё загружается — объяснения появятся чуть позже'
      el.classList.toggle('lq-model-status--ok', data.ready)
    } catch {
      el.textContent = '🔴 Сервис teacher/server.py недоступен (порт 5000) — объяснения ошибок будут недоступны, тест по-прежнему работает'
      el.classList.add('lq-model-status--error')
    }
  }

  // --- Экран прохождения теста ----------------------------------------------
  function startQuiz(mode: Mode): void {
    const indices = QUESTIONS.map((_, i) => i)
    let order: number[]
    if (mode === 'random') order = shuffle(indices)
    else if (mode === 'wrong') order = wrongIds.length > 0 ? [...wrongIds] : indices
    else order = indices

    state = { mode, order, currentIndex: 0, answers: {} }
    save()
    renderQuiz()
  }

  function renderQuiz(): void {
    const q = currentQuestion()
    if (!q) {
      renderStart()
      return
    }
    const total = state.order.length
    const ans = state.answers[q.id]
    const checked = ans?.checked ?? false

    root.innerHTML = ''
    const wrap = document.createElement('div')
    wrap.className = 'lq-quiz'
    wrap.innerHTML = `
      <header class="lq-header">
        <div class="lq-header-title">Вопрос ${state.currentIndex + 1} из ${total}</div>
        <div class="lq-progress-chip"><b>${countCorrect()}</b> верно / <b>${countDone()}</b> отвечено</div>
      </header>
      <div class="lq-progress-bar"><div class="lq-progress-bar-fill" style="width:${(countDone() / total) * 100}%"></div></div>
      <div class="lq-nav">
        <button type="button" class="plasma-cta plasma-cta-outline" id="lq-prev" ${state.currentIndex === 0 ? 'disabled' : ''}>← Назад</button>
        <div class="lq-nav-counter">${state.currentIndex + 1} / ${total}</div>
        <button type="button" class="plasma-cta plasma-cta-outline" id="lq-next" ${state.currentIndex === total - 1 ? 'disabled' : ''}>Вперёд →</button>
      </div>
      <article class="lq-question-card">
        <div class="lq-q-meta">
          <span class="lq-q-num">Вопрос ${q.id}</span>
          ${q.multi ? '<span class="lq-multi-badge">⊞ Несколько ответов</span>' : ''}
        </div>
        <div class="lq-q-text"></div>
      </article>
      <div class="lq-options" id="lq-options"></div>
      <div class="lq-actions">
        <button type="button" class="plasma-cta plasma-cta-primary" id="lq-check" ${!ans || ans.selected.length === 0 ? 'disabled' : ''}>Проверить</button>
        <button type="button" class="plasma-cta plasma-cta-outline" id="lq-next-q" style="display:${checked ? '' : 'none'}">Следующий →</button>
        <button type="button" class="plasma-cta plasma-cta-outline" id="lq-skip">Пропустить</button>
        <button type="button" class="plasma-cta plasma-cta-outline lq-finish-btn" id="lq-finish">Завершить тест</button>
      </div>
      <div class="lq-feedback" id="lq-feedback"></div>
      <div class="lq-map-title">Карта вопросов</div>
      <div class="lq-map" id="lq-map"></div>
    `
    wrap.querySelector('.lq-q-text')!.textContent = q.q
    root.appendChild(wrap)

    wrap.querySelector('#lq-prev')!.addEventListener('click', () => navigate(-1))
    wrap.querySelector('#lq-next')!.addEventListener('click', () => navigate(1))
    wrap.querySelector('#lq-check')!.addEventListener('click', checkAnswer)
    wrap.querySelector('#lq-next-q')!.addEventListener('click', () => navigate(1))
    wrap.querySelector('#lq-skip')!.addEventListener('click', skipQuestion)
    wrap.querySelector('#lq-finish')!.addEventListener('click', finishQuiz)

    renderOptions(q)
    renderFeedback(q)
    renderMap()
  }

  function renderOptions(q: LearningQuestion & { multi: boolean }): void {
    const container = root.querySelector<HTMLElement>('#lq-options')!
    container.innerHTML = ''
    const ans = state.answers[q.id]
    const checked = ans?.checked ?? false

    q.o.forEach((opt, oi) => {
      const el = document.createElement('button')
      el.type = 'button'
      const isSelected = !!ans?.selected.includes(oi)
      const classes = ['lq-option']
      if (q.multi) classes.push('lq-option--checkbox')
      if (isSelected) classes.push('is-selected')
      if (checked) {
        const isCorrect = q.a.includes(oi)
        if (isCorrect && isSelected) classes.push('is-correct')
        else if (!isCorrect && isSelected) classes.push('is-wrong')
        else if (isCorrect && !isSelected) classes.push('is-missed')
      }
      el.className = classes.join(' ')
      el.disabled = checked
      el.innerHTML = `<span class="lq-option-indicator">${isSelected ? '✓' : ''}</span><span class="lq-option-text"></span>`
      el.querySelector('.lq-option-text')!.textContent = opt
      el.addEventListener('click', () => toggleOption(q, oi))
      container.appendChild(el)
    })
  }

  function toggleOption(q: LearningQuestion & { multi: boolean }, oi: number): void {
    let ans = state.answers[q.id]
    if (ans?.checked) return
    if (!ans) ans = { selected: [], checked: false, correct: false }
    if (q.multi) {
      const idx = ans.selected.indexOf(oi)
      if (idx === -1) ans.selected.push(oi)
      else ans.selected.splice(idx, 1)
    } else {
      ans.selected = [oi]
    }
    state.answers[q.id] = ans
    const checkBtn = root.querySelector<HTMLButtonElement>('#lq-check')
    if (checkBtn) checkBtn.disabled = ans.selected.length === 0
    renderOptions(q)
  }

  function checkAnswer(): void {
    const q = currentQuestion()
    const ans = q && state.answers[q.id]
    if (!q || !ans || ans.selected.length === 0) return
    const selectedSorted = [...ans.selected].sort().join(',')
    const correctSorted = [...q.a].sort().join(',')
    ans.checked = true
    ans.correct = selectedSorted === correctSorted
    save()
    renderQuiz()
  }

  function skipQuestion(): void {
    const q = currentQuestion()
    if (q && !state.answers[q.id]) {
      state.answers[q.id] = { selected: [], checked: false, correct: false, skipped: true }
    }
    navigate(1)
  }

  function navigate(dir: number): void {
    const idx = state.currentIndex + dir
    if (idx < 0 || idx >= state.order.length) return
    state.currentIndex = idx
    save()
    renderQuiz()
  }

  function renderFeedback(q: LearningQuestion & { multi: boolean }): void {
    const el = root.querySelector<HTMLElement>('#lq-feedback')!
    const ans = state.answers[q.id]
    el.innerHTML = ''
    if (!ans?.checked) return
    el.classList.toggle('is-ok', ans.correct)
    el.classList.toggle('is-fail', !ans.correct)
    const line = document.createElement('div')
    line.textContent = ans.correct ? '✓ Правильно!' : `✗ Неверно. Правильный ответ: ${q.a.map((i) => q.o[i]).join('; ')}`
    el.appendChild(line)
    if (q.src) {
      const src = document.createElement('div')
      src.className = 'lq-feedback-source'
      src.textContent = q.src
      el.appendChild(src)
    }
  }

  function renderMap(): void {
    const map = root.querySelector<HTMLElement>('#lq-map')!
    map.innerHTML = ''
    state.order.forEach((qIdx, i) => {
      const q = QUESTIONS[qIdx]
      const ans = state.answers[q.id]
      const btn = document.createElement('button')
      btn.type = 'button'
      const classes = ['lq-map-dot']
      if (i === state.currentIndex) classes.push('is-current')
      else if (ans?.checked) classes.push(ans.correct ? 'is-ok' : 'is-fail')
      else if (ans?.skipped) classes.push('is-skipped')
      btn.className = classes.join(' ')
      btn.textContent = String(i + 1)
      btn.addEventListener('click', () => {
        state.currentIndex = i
        save()
        renderQuiz()
      })
      map.appendChild(btn)
    })
  }

  // --- Результаты ------------------------------------------------------------
  function finishQuiz(): void {
    const total = state.order.length
    const done = countDone()
    const correct = countCorrect()
    const skipped = total - done
    const wrong = done - correct

    wrongIds = []
    const mistakes: Mistake[] = []
    for (const qIdx of state.order) {
      const q = QUESTIONS[qIdx]
      const ans = state.answers[q.id]
      if (ans?.checked && !ans.correct) {
        wrongIds.push(qIdx)
        mistakes.push({
          id: q.id,
          question: q.q,
          options: q.o,
          correct: q.a[0],
          userAnswer: ans.selected[0] ?? null,
          src: q.src,
        })
      }
    }

    const pct = total > 0 ? Math.round((correct / total) * 100) : 0
    let title = 'Нужно повторить материал'
    if (pct >= 90) title = 'Отличный результат!'
    else if (pct >= 70) title = 'Хороший результат'
    else if (pct >= 50) title = 'Можно лучше'

    root.innerHTML = ''
    const wrap = document.createElement('div')
    wrap.className = 'lq-results'
    const circumference = 314
    wrap.innerHTML = `
      <div class="lq-score-ring">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="10"/>
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--plasma-color, #0ff)" stroke-width="10"
            stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" id="lq-score-arc"/>
        </svg>
        <div class="lq-score-text">${pct}%</div>
      </div>
      <h2 class="lq-results-title">${title}</h2>
      <p class="lq-results-sub">Отвечено: ${done} из ${total}</p>
      <div class="lq-stats">
        <div class="lq-stat"><div class="lq-stat-num lq-stat-num--ok">${correct}</div><div class="lq-stat-label">Верно</div></div>
        <div class="lq-stat"><div class="lq-stat-num lq-stat-num--fail">${wrong}</div><div class="lq-stat-label">Неверно</div></div>
        <div class="lq-stat"><div class="lq-stat-num lq-stat-num--skip">${skipped}</div><div class="lq-stat-label">Пропущено</div></div>
        <div class="lq-stat"><div class="lq-stat-num">${total}</div><div class="lq-stat-label">Всего</div></div>
      </div>
      <div class="lq-actions">
        <button type="button" class="plasma-cta plasma-cta-primary" id="lq-restart">Пройти заново</button>
        <button type="button" class="plasma-cta plasma-cta-outline" id="lq-retry" ${wrongIds.length === 0 ? 'disabled' : ''}>Повторить ошибки</button>
        <button type="button" class="plasma-cta plasma-cta-outline" id="lq-chat" ${mistakes.length === 0 ? 'style="display:none"' : ''}>🧑‍🏫 Объяснить ошибки</button>
        <button type="button" class="plasma-cta plasma-cta-outline" id="lq-breakdown">Подробный разбор</button>
      </div>
      <div class="lq-breakdown" id="lq-breakdown-panel" style="display:none"></div>
      <div class="lq-chat" id="lq-chat-panel" style="display:none"></div>
    `
    root.appendChild(wrap)

    // Разбор и карта показываются по снимку прошедшего теста — берём его до сброса state.
    const finishedOrder = [...state.order]
    const finishedAnswers = { ...state.answers }
    setData(PROGRESS_KEY, emptyState())
    state = emptyState()

    wrap.querySelector('#lq-restart')!.addEventListener('click', renderStart)
    wrap.querySelector('#lq-retry')!.addEventListener('click', () => startQuiz('wrong'))
    wrap.querySelector('#lq-breakdown')!.addEventListener('click', () => renderFullBreakdown(wrap, finishedOrder, finishedAnswers))
    const chatBtn = wrap.querySelector<HTMLButtonElement>('#lq-chat')!
    if (mistakes.length > 0) chatBtn.addEventListener('click', () => openTeacherChat(mistakes, wrap))

    requestAnimationFrame(() => {
      const arc = wrap.querySelector<SVGCircleElement>('#lq-score-arc')
      if (arc) {
        arc.style.transition = 'stroke-dashoffset 1s ease'
        arc.style.strokeDashoffset = String(circumference - (circumference * pct) / 100)
      }
    })
  }

  /** Подробный разбор всех вопросов пройденного теста: статус, отмеченные варианты
   * (верно/неверно/пропущено), источник цитаты. Разворачивается/сворачивается по клику. */
  function renderFullBreakdown(wrap: HTMLElement, order: number[], answers: Record<number, AnswerState>): void {
    const panel = wrap.querySelector<HTMLElement>('#lq-breakdown-panel')!
    if (panel.style.display === 'block') {
      panel.style.display = 'none'
      return
    }
    panel.style.display = 'block'
    panel.innerHTML = ''

    const heading = document.createElement('h3')
    heading.textContent = 'Разбор по вопросам'
    panel.appendChild(heading)

    for (const qIdx of order) {
      const q = QUESTIONS[qIdx]
      const ans = answers[q.id]
      const item = document.createElement('div')
      item.className = 'lq-breakdown-item'

      const head = document.createElement('div')
      head.className = 'lq-breakdown-head'
      const badge = document.createElement('span')
      badge.className = 'lq-breakdown-badge'
      if (ans?.checked) badge.classList.add(ans.correct ? 'is-ok' : 'is-fail')
      else badge.classList.add('is-skip')
      badge.textContent = ans?.checked ? (ans.correct ? '✓' : '✗') : '?'
      const qText = document.createElement('div')
      qText.className = 'lq-breakdown-q'
      qText.textContent = `Вопрос ${q.id}. ${q.q}`
      head.append(badge, qText)
      item.appendChild(head)

      const optionsList = document.createElement('div')
      optionsList.className = 'lq-breakdown-options'
      q.o.forEach((opt, oi) => {
        const isCorrect = q.a.includes(oi)
        const isSelected = !!ans?.selected.includes(oi)
        const row = document.createElement('div')
        row.className = 'lq-breakdown-option'
        if (isCorrect && isSelected) row.classList.add('is-ok')
        else if (isSelected && !isCorrect) row.classList.add('is-fail')
        else if (isCorrect && !isSelected) row.classList.add('is-missed')
        row.textContent = `${isCorrect && isSelected ? '✓' : isSelected ? '✗' : isCorrect ? '!' : '○'} ${opt}`
        optionsList.appendChild(row)
      })
      item.appendChild(optionsList)

      if (q.src) {
        const src = document.createElement('div')
        src.className = 'lq-breakdown-source'
        src.textContent = q.src
        item.appendChild(src)
      }

      panel.appendChild(item)
    }
  }

  /** Разбор ошибок + свободный диалог с учителем — как в teacher/quiz.js: пузыри
   * сообщений, объяснения по кнопке, свободный вопрос через /api/chat/free, история
   * диалога хранится в localStorage (lib/storage.ts) и переживает переоткрытие панели,
   * пока набор вопросов-ошибок не изменился (см. loadChatHistory). */
  async function openTeacherChat(mistakes: Mistake[], wrap: HTMLElement): Promise<void> {
    const panel = wrap.querySelector<HTMLElement>('#lq-chat-panel')!
    panel.style.display = 'block'
    panel.innerHTML = `
      <h3 class="lq-chat-section-title">Ваши ошибки</h3>
      <div class="lq-chat-mistakes" id="lq-chat-mistakes-list"></div>
      <h3 class="lq-chat-section-title">Диалог с учителем</h3>
      <div class="lq-chat-messages" id="lq-chat-messages"></div>
      <div class="lq-chat-input-row">
        <input type="text" class="lq-chat-input" id="lq-chat-input" placeholder="Задайте вопрос учителю…" />
        <button type="button" class="plasma-cta plasma-cta-primary" id="lq-chat-send">Отправить</button>
      </div>
    `

    const mistakesList = panel.querySelector<HTMLElement>('#lq-chat-mistakes-list')!
    for (const m of mistakes) {
      const item = document.createElement('div')
      item.className = 'lq-chat-mistake'
      const q = document.createElement('div')
      q.className = 'lq-chat-mistake-q'
      q.textContent = m.question
      const answers = document.createElement('div')
      answers.className = 'lq-chat-mistake-answers'
      const userAns = document.createElement('span')
      userAns.textContent = `Ваш ответ: ${m.userAnswer !== null ? m.options[m.userAnswer] : '(не выбрано)'}`
      const correctAns = document.createElement('span')
      correctAns.className = 'lq-chat-correct'
      correctAns.textContent = `Правильный: ${m.options[m.correct]}`
      answers.append(userAns, correctAns)
      item.append(q, answers)
      mistakesList.appendChild(item)
    }

    const messages = panel.querySelector<HTMLElement>('#lq-chat-messages')!
    const input = panel.querySelector<HTMLInputElement>('#lq-chat-input')!
    const sendBtn = panel.querySelector<HTMLButtonElement>('#lq-chat-send')!
    const history: ChatMessage[] = loadChatHistory(mistakes)

    // Черновик недописанного вопроса — чтобы не терять его при закрытии кабинета до отправки.
    input.value = getData<string>(CHAT_DRAFT_KEY, '')
    input.addEventListener('input', () => setData(CHAT_DRAFT_KEY, input.value))

    function appendMessage(sender: ChatMessage['sender'], text: string, contextLabel?: string | null, detailFor?: Mistake): HTMLElement {
      const row = document.createElement('div')
      row.className = `lq-chat-row lq-chat-row--${sender}`
      const avatar = document.createElement('div')
      avatar.className = 'lq-chat-avatar'
      avatar.textContent = sender === 'user' ? '🧑' : '🤖'
      const bubble = document.createElement('div')
      bubble.className = 'lq-chat-bubble'
      if (contextLabel) {
        const label = document.createElement('div')
        label.className = 'lq-chat-bubble-context'
        label.textContent = contextLabel
        bubble.appendChild(label)
      }
      const textEl = document.createElement('div')
      textEl.className = 'lq-chat-bubble-text'
      textEl.textContent = text
      bubble.appendChild(textEl)
      row.append(avatar, bubble)
      if (detailFor) {
        const detailBtn = document.createElement('button')
        detailBtn.type = 'button'
        detailBtn.className = 'lq-chat-detail-btn'
        detailBtn.textContent = '📖 Подробнее'
        detailBtn.addEventListener('click', () => requestDetail(detailFor, text, detailBtn, row))
        bubble.appendChild(detailBtn)
      }
      messages.appendChild(row)
      messages.scrollTop = messages.scrollHeight
      return row
    }

    async function requestDetail(mistake: Mistake, previousExplanation: string, button: HTMLButtonElement, row: HTMLElement): Promise<void> {
      button.disabled = true
      button.textContent = '⏳'
      try {
        const res = await fetch(`${TEACHER_API_BASE}/api/chat/detail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: mistake.id,
            question: mistake.question,
            options: mistake.options,
            correct: mistake.correct,
            previous_explanation: previousExplanation,
            src: mistake.src,
          }),
        })
        const data = (await res.json()) as { detail?: string; error?: string }
        if (data.error || !data.detail) {
          button.textContent = '📖 Подробнее'
          button.disabled = false
          return
        }
        const contextLabel = `Вопрос ${mistake.id} · подробнее`
        history.push({ sender: 'bot', text: data.detail, contextLabel, mistakeId: mistake.id, kind: 'detail' })
        setData(CHAT_HISTORY_KEY, history)
        appendMessage('bot', data.detail, contextLabel)
        row.querySelector('.lq-chat-detail-btn')?.remove()
      } catch {
        button.textContent = '📖 Подробнее'
        button.disabled = false
      }
    }

    async function sendFreeQuestion(): Promise<void> {
      const question = input.value.trim()
      if (!question) return
      input.value = ''
      setData(CHAT_DRAFT_KEY, '')
      sendBtn.disabled = true
      history.push({ sender: 'user', text: question, contextLabel: null, mistakeId: null, kind: 'free' })
      setData(CHAT_HISTORY_KEY, history)
      appendMessage('user', question)

      const loadingRow = appendMessage('bot', '⏳ Печатает…')
      try {
        const context = history
          .filter((m) => m.kind === 'free')
          .slice(-10)
          .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))

        const res = await fetch(`${TEACHER_API_BASE}/api/chat/free`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, context }),
        })
        const data = (await res.json()) as { answer?: string; error?: string }
        loadingRow.remove()
        if (data.error || !data.answer) {
          appendMessage('bot', data.error ?? 'Не удалось получить ответ.')
        } else {
          history.push({ sender: 'bot', text: data.answer, contextLabel: null, mistakeId: null, kind: 'free' })
          setData(CHAT_HISTORY_KEY, history)
          appendMessage('bot', data.answer)
        }
      } catch {
        loadingRow.remove()
        appendMessage('bot', 'Ошибка соединения с teacher/server.py (порт 5000).')
      } finally {
        sendBtn.disabled = false
      }
    }

    sendBtn.addEventListener('click', sendFreeQuestion)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendFreeQuestion()
    })

    if (history.length > 0) {
      for (const msg of history) {
        const mistake = msg.mistakeId !== null ? mistakes.find((m) => m.id === msg.mistakeId) : undefined
        appendMessage(msg.sender, msg.text, msg.contextLabel, msg.kind === 'explanation' ? mistake : undefined)
      }
      return
    }

    const loadingRow = appendMessage('bot', '⏳ Учитель готовит объяснения…')
    try {
      const res = await fetch(`${TEACHER_API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mistakes }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { explanations?: { id: number; explanation: string }[]; error?: string }
      loadingRow.remove()
      if (data.error || !data.explanations) {
        appendMessage('bot', data.error ?? 'Не удалось получить объяснения.')
        return
      }
      for (const exp of data.explanations) {
        const mistake = mistakes.find((m) => m.id === exp.id)
        const contextLabel = mistake ? `Вопрос ${mistake.id}` : null
        history.push({ sender: 'bot', text: exp.explanation, contextLabel, mistakeId: exp.id, kind: 'explanation' })
        appendMessage('bot', exp.explanation, contextLabel, mistake)
      }
      setData(CHAT_HISTORY_KEY, history)
    } catch {
      loadingRow.remove()
      appendMessage('bot', 'Ошибка соединения с teacher/server.py (порт 5000). Проверьте, что сервис запущен.')
    }
  }

  // Возобновляем тест, если есть сохранённый прогресс, иначе — стартовый экран.
  if (state.order.length > 0) renderQuiz()
  else renderStart()

  return root
}
