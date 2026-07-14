import type { PageContent } from '../../../../types/page-content.ts'
import { getUser } from '../../../../lib/auth.ts'

const DOCS: { title: string; roles: string[] }[] = [
  { title: 'Инженерная документация (схемы, чертежи)', roles: ['engineer', 'admin'] },
  { title: 'Бухгалтерские отчёты (баланс, налоги)', roles: ['accountant', 'admin'] },
  { title: 'Политика безопасности', roles: ['admin'] },
  { title: 'Общие инструкции', roles: ['engineer', 'accountant', 'admin'] },
  { title: 'Технические спецификации', roles: ['engineer'] },
  { title: 'Финансовые планы', roles: ['accountant', 'admin'] },
]

function renderDocs(): HTMLElement {
  const role = getUser()?.role ?? 'guest'
  const container = document.createElement('div')
  container.className = 'docs-container'

  const heading = document.createElement('h3')
  heading.textContent = `Документы, доступные для роли «${role}»`
  container.appendChild(heading)

  const accessible = DOCS.filter((doc) => doc.roles.includes(role))
  if (accessible.length === 0) {
    const empty = document.createElement('p')
    empty.textContent = 'Нет доступных документов для вашей роли.'
    container.appendChild(empty)
    return container
  }

  const list = document.createElement('ul')
  list.className = 'docs-list'
  for (const doc of accessible) {
    const li = document.createElement('li')
    li.textContent = doc.title
    list.appendChild(li)
  }
  container.appendChild(list)

  return container
}

export const docsPageContent: PageContent = {
  title: 'Корпоративная документация',
  blocks: [
    {
      kind: 'custom',
      render: renderDocs,
    },
  ],
}
