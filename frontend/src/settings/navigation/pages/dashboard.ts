import type { PageContent, PageNavigationTarget } from '../../../types/page-content.ts'
import { getUser } from '../../../lib/auth.ts'
import { DASHBOARD_NAV_CARDS, PRIVATE_PAGE_COLORS, ROLE_LABELS } from '../private.ts'

/** Ряд разворачивающихся по наведению карточек-разделов («flex cards»): наведение
 * расширяет карточку и открывает подпись, клик — сразу переходит в раздел (в т.ч.
 * на тач-экранах, где ховера нет). */
function renderNavCards(navigateTo: (target: PageNavigationTarget) => void): HTMLElement {
  const list = document.createElement('div')
  list.className = 'flex-cards'
  list.setAttribute('role', 'list')

  const cards = DASHBOARD_NAV_CARDS.map((card, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'flex-card'
    if (index === 0) button.classList.add('active')
    button.style.setProperty('--card-color', PRIVATE_PAGE_COLORS[card.key])

    button.innerHTML = `
      <svg class="flex-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${card.icon}</svg>
      <span class="flex-card-body">
        <span class="flex-card-title">${card.title}</span>
        <span class="flex-card-desc">${card.desc}</span>
      </span>
    `

    function activate(): void {
      for (const el of list.children) el.classList.remove('active')
      button.classList.add('active')
    }

    button.addEventListener('mouseenter', activate)
    button.addEventListener('focus', activate)
    button.addEventListener('click', () => navigateTo({ private: card.key }))
    return button
  })

  list.append(...cards)
  return list
}

function renderDashboard(navigateTo: (target: PageNavigationTarget) => void): HTMLElement {
  const user = getUser()
  const container = document.createElement('div')
  container.className = 'dashboard-container'

  container.innerHTML = `
    <div class="dashboard-hero">
      <div class="dashboard-hero-text">
        <p class="dashboard-eyebrow">Личный кабинет</p>
        <h2 class="dashboard-greeting">Добро пожаловать, ${user?.username ?? 'пользователь'}</h2>
        <p class="dashboard-role">${user ? ROLE_LABELS[user.role] : ''}</p>
      </div>
    </div>
  `

  container.appendChild(renderNavCards(navigateTo))
  return container
}

/** Строится заново при каждом открытии (а не как константа при импорте модуля),
 * чтобы заголовок с именем пользователя не оставался «пустым» из-за захвата
 * значения до фактического входа. */
export function buildDashboardPageContent(): PageContent {
  return {
    title: '',
    blocks: [
      {
        kind: 'custom',
        render: ({ navigateTo }) => renderDashboard(navigateTo),
      },
    ],
  }
}
