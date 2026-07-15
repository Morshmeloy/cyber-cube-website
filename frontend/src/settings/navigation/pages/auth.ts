import type { PageContent, PageNavigationTarget } from '../../../types/page-content.ts'
import { login } from '../../../lib/auth.ts'

const SCAN_DURATION_MS = 2200
const SUCCESS_DISPLAY_MS = 1100

/** «Вход по биометрии»: включает камеру, изображает сканирование лица и затем действительно
 * авторизует — но без какой-либо реальной привязки к лицу. Любое лицо (или вообще без камеры,
 * если доступ не дан — тогда вход не выполняется) заходит в один и тот же демо-аккаунт admin
 * через тот же login(), что и обычная форма. Поток камеры останавливается при закрытии окна
 * и в момент «успеха», чтобы не оставаться включённой в фоне. */
function openBiometricLogin(navigateTo: (target: PageNavigationTarget) => void): void {
  const overlay = document.createElement('div')
  overlay.className = 'face-login-overlay'
  overlay.innerHTML = `
    <div class="face-login-modal" role="dialog" aria-modal="true" aria-labelledby="face-login-title">
      <button type="button" class="face-login-close" aria-label="Закрыть">&times;</button>
      <h3 class="face-login-title" id="face-login-title">Вход по биометрии</h3>
      <div class="face-login-frame">
        <video class="face-login-video" autoplay muted playsinline></video>
        <div class="face-login-scan-ring"></div>
        <div class="face-login-success">
          <svg viewBox="0 0 52 52" class="face-login-check">
            <circle class="face-login-check-circle" cx="26" cy="26" r="24" fill="none" />
            <path class="face-login-check-mark" fill="none" d="M14 27l7 7 17-17" />
          </svg>
        </div>
      </div>
      <p class="face-login-status">Наведите камеру на лицо…</p>
      <p class="face-login-caption">Демо-режим: реального распознавания лица нет. По этой кнопке в любом случае выполняется вход в демонстрационный аккаунт «admin» — без привязки к тому, чьё лицо в кадре.</p>
      <p class="face-login-error" style="display:none"></p>
    </div>
  `
  document.body.appendChild(overlay)

  const frame = overlay.querySelector<HTMLElement>('.face-login-frame')!
  const video = overlay.querySelector<HTMLVideoElement>('.face-login-video')!
  const statusEl = overlay.querySelector<HTMLElement>('.face-login-status')!
  const errorEl = overlay.querySelector<HTMLElement>('.face-login-error')!
  let stream: MediaStream | null = null
  let closed = false

  function stopStream(): void {
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
  }
  function close(): void {
    closed = true
    stopStream()
    document.removeEventListener('keydown', onKeydown)
    overlay.remove()
  }
  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') close()
  }
  overlay.querySelector('.face-login-close')!.addEventListener('click', close)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })
  document.addEventListener('keydown', onKeydown)

  async function runSuccess(): Promise<void> {
    if (closed) return
    frame.classList.add('is-success')
    statusEl.textContent = 'Личность подтверждена ✓'
    stopStream()

    await new Promise((resolve) => window.setTimeout(resolve, SUCCESS_DISPLAY_MS))
    if (closed) return
    statusEl.textContent = 'Выполняется вход как admin…'

    const result = await login('admin', 'admin')
    if (closed) return

    if ('user' in result) {
      close()
      navigateTo({ private: 'dashboard' })
      return
    }

    frame.classList.remove('is-success')
    errorEl.textContent =
      result.error === 'server-unreachable'
        ? 'Сервер авторизации недоступен. Убедитесь, что backend запущен (порт 9000).'
        : 'Не удалось выполнить демо-вход.'
    errorEl.style.display = 'block'
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    errorEl.textContent = 'Браузер не поддерживает доступ к камере.'
    errorEl.style.display = 'block'
    return
  }

  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then((s) => {
      if (closed) {
        s.getTracks().forEach((track) => track.stop())
        return
      }
      stream = s
      video.srcObject = stream
      statusEl.textContent = 'Сканирование лица…'
      window.setTimeout(runSuccess, SCAN_DURATION_MS)
    })
    .catch(() => {
      errorEl.textContent = 'Не удалось получить доступ к камере — проверьте разрешения браузера.'
      errorEl.style.display = 'block'
    })
}

function renderLoginForm(navigateTo: (target: PageNavigationTarget) => void): HTMLElement {
  const container = document.createElement('div')
  container.className = 'login-form-container'
  container.innerHTML = `
    <form id="login-form" class="login-form">
      <div class="form-group">
        <label for="username">Логин</label>
        <input type="text" id="username" placeholder="Введите логин" required />
      </div>
      <div class="form-group">
        <label for="password">Пароль</label>
        <input type="password" id="password" placeholder="Введите пароль" required />
      </div>
      <button type="submit" class="btn-primary">Войти</button>
      <button type="button" class="btn-secondary face-login-trigger">📷 Вход по биометрии (демо)</button>
      <div class="login-error" style="display:none"></div>
    </form>
  `
  const form = container.querySelector<HTMLFormElement>('#login-form')!
  const usernameInput = form.querySelector<HTMLInputElement>('#username')!
  const passwordInput = form.querySelector<HTMLInputElement>('#password')!
  const submitButton = form.querySelector<HTMLButtonElement>('.btn-primary')!
  const errorDiv = form.querySelector<HTMLElement>('.login-error')!

  form.querySelector('.face-login-trigger')!.addEventListener('click', () => openBiometricLogin(navigateTo))

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    errorDiv.style.display = 'none'
    submitButton.disabled = true
    submitButton.textContent = 'Проверка…'

    const result = await login(usernameInput.value.trim(), passwordInput.value.trim())

    submitButton.disabled = false
    submitButton.textContent = 'Войти'

    if ('user' in result) {
      navigateTo({ private: 'dashboard' })
      return
    }

    errorDiv.textContent =
      result.error === 'server-unreachable'
        ? 'Сервер авторизации недоступен. Убедитесь, что backend запущен (порт 9000).'
        : 'Неверный логин или пароль. Демо-доступ: admin/admin, engineer/eng, accountant/acc, employee/emp'
    errorDiv.style.display = 'block'
  })

  return container
}

/** Грань «Авторизация» (лицевая грань с логотипом) — вход в личный кабинет проверяется
 * реальным бэкендом (POST http://localhost:9000/api/login, см. backend/main.py), а не
 * локально зашитыми учётками. После входа ведёт на dashboard.ts. */
export const authPageContent: PageContent = {
  title: 'Вход в личный кабинет',
  blocks: [
    {
      kind: 'custom',
      render: ({ navigateTo }) => renderLoginForm(navigateTo),
    },
    {
      kind: 'paragraph',
      text: 'Для демонстрации используйте один из логинов: admin/admin, engineer/eng, accountant/acc, employee/emp.',
    },
  ],
}
