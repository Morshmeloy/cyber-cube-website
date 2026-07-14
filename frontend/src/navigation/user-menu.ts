import type { PageNavigationTarget } from '../types/page-content.ts'
import { getUser, logout } from '../lib/auth.ts'
import { ROLE_LABELS } from '../settings/navigation/private.ts'
import { LOGO_MARK_IMAGE_PATH, SITE_NAME } from '../settings/site/site.ts'

export interface UserMenuController {
  /** Перерисовывает виджет по текущему состоянию авторизации — вызывать после входа/выхода. */
  update(): void
}

/** Виджет профиля в правом верхнем углу — вне плазменной панели, поверх куба и любой
 * открытой страницы. Пусто, пока пользователь не вошёл; после входа — аватар (лого),
 * логин, роль и выпадающее меню с переходом в кабинет и выходом. */
export function createUserMenu(container: HTMLElement, navigateTo: (target: PageNavigationTarget) => void): UserMenuController {
  function render(): void {
    const user = getUser()
    container.innerHTML = ''
    if (!user) return

    const wrapper = document.createElement('div')
    wrapper.className = 'user-menu-widget'

    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = 'user-menu-trigger'
    trigger.setAttribute('aria-haspopup', 'true')
    trigger.innerHTML = `
      <span class="user-menu-avatar"><img src="${LOGO_MARK_IMAGE_PATH}" alt="${SITE_NAME}" /></span>
      <span class="user-menu-info">
        <span class="user-menu-name">${user.username}</span>
        <span class="user-menu-role">${ROLE_LABELS[user.role]}</span>
      </span>
      <svg class="user-menu-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    `

    const dropdown = document.createElement('div')
    dropdown.className = 'user-menu-dropdown'
    dropdown.innerHTML = `
      <button type="button" class="user-menu-item" data-action="dashboard">Личный кабинет</button>
      <button type="button" class="user-menu-item user-menu-item-danger" data-action="logout">Выйти</button>
    `

    trigger.addEventListener('click', () => wrapper.classList.toggle('open'))

    dropdown.querySelector('[data-action="dashboard"]')!.addEventListener('click', () => {
      wrapper.classList.remove('open')
      navigateTo({ private: 'dashboard' })
    })
    dropdown.querySelector('[data-action="logout"]')!.addEventListener('click', () => {
      wrapper.classList.remove('open')
      logout()
      navigateTo({ face: 'front' })
      render()
    })

    wrapper.append(trigger, dropdown)
    container.appendChild(wrapper)
  }

  document.addEventListener('click', (e) => {
    const wrapper = container.querySelector('.user-menu-widget')
    if (wrapper && !wrapper.contains(e.target as Node)) wrapper.classList.remove('open')
  })
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    container.querySelector('.user-menu-widget')?.classList.remove('open')
  })

  render()
  return { update: render }
}
