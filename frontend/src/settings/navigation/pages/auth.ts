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
  const errorDiv = form.querySelector<HTMLElement>('.login-error')!

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const user = login(usernameInput.value.trim(), passwordInput.value.trim())
    if (user) {
      navigateTo({ private: 'dashboard' })
      return
    }
    errorDiv.textContent = 'Неверный логин или пароль. Демо-доступ: admin/admin, engineer/engineer, accountant/accountant'
    errorDiv.style.display = 'block'
  })

  return container
}

/** Грань «Авторизация» (лицевая грань с логотипом) — демо-вход в личный кабинет без бэкенда,
 * учётки зашиты в lib/auth.ts. После входа ведёт на dashboard.ts. */
export const authPageContent: PageContent = {
  title: 'Вход в личный кабинет',
  blocks: [
    {
      kind: 'custom',
      render: ({ navigateTo }) => renderLoginForm(navigateTo),
    },
    {
      kind: 'paragraph',
      text: 'Для демонстрации используйте один из логинов: admin/admin, engineer/engineer, accountant/accountant.',
    },
  ],
}
