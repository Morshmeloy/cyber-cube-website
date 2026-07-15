import type { PageContent, PageNavigationTarget } from '../../../types/page-content.ts'
import { login } from '../../../lib/auth.ts'

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
      <div class="login-error" style="display:none"></div>
    </form>
  `
  const form = container.querySelector<HTMLFormElement>('#login-form')!
  const usernameInput = form.querySelector<HTMLInputElement>('#username')!
  const passwordInput = form.querySelector<HTMLInputElement>('#password')!
  const submitButton = form.querySelector<HTMLButtonElement>('.btn-primary')!
  const errorDiv = form.querySelector<HTMLElement>('.login-error')!

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
