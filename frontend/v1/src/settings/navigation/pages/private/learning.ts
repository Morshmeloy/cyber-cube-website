import type { PageContent } from '../../../../types/page-content.ts'

function renderLearning(): HTMLElement {
  const container = document.createElement('div')
  container.className = 'learning-iframe-container'
  const iframe = document.createElement('iframe')
  // Проксируется dev-сервером Vite (vite.config.ts) на локальный сервис teacher/.
  iframe.src = '/teacher'
  container.appendChild(iframe)
  return container
}

export const learningPageContent: PageContent = {
  title: 'Обучение: Компьютерные сети',
  blocks: [
    {
      kind: 'custom',
      render: renderLearning,
    },
  ],
}
