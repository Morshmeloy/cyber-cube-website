import type { AudioEngine } from '../types/audio.ts'
import type { PlasmaElements, PlasmaCallbacks, PlasmaController } from '../types/plasma.ts'
import type { PageBlock, PageContent } from '../types/page-content.ts'
import { BLOCK_REVEAL_STAGGER_MS } from '../settings/navigation/plasma.ts'
import { createImageCarousel } from './certificate-carousel.ts'

function renderBlock(block: PageBlock): HTMLElement {
  switch (block.kind) {
    case 'heading': {
      const el = document.createElement(block.level === 2 ? 'h2' : 'h3')
      el.className = 'plasma-block plasma-heading'
      el.textContent = block.text
      return el
    }
    case 'paragraph': {
      const el = document.createElement('p')
      el.className = 'plasma-block plasma-paragraph'
      el.textContent = block.text
      return el
    }
    case 'list': {
      const el = document.createElement('ul')
      el.className = 'plasma-block plasma-list'
      for (const item of block.items) {
        const li = document.createElement('li')
        li.textContent = item
        el.appendChild(li)
      }
      return el
    }
    case 'cardGrid': {
      const el = document.createElement('div')
      el.className = 'plasma-block plasma-card-grid'
      for (const card of block.cards) {
        const cardEl = document.createElement('div')
        cardEl.className = 'plasma-card'
        const titleEl = document.createElement('h4')
        titleEl.textContent = card.title
        const textEl = document.createElement('p')
        textEl.textContent = card.text
        cardEl.append(titleEl, textEl)
        el.appendChild(cardEl)
      }
      return el
    }
    case 'imageGallery': {
      const el = document.createElement('div')
      el.className = 'plasma-block'
      el.appendChild(createImageCarousel(block.images))
      return el
    }
    case 'contactInfo': {
      const el = document.createElement('div')
      el.className = 'plasma-block plasma-contact'
      for (const line of block.lines) {
        const p = document.createElement('p')
        p.textContent = line
        el.appendChild(p)
      }
      return el
    }
  }
}

/** Создаёт плазменный информационный экран — полноразмерную панель страницы грани куба. */
export function createPlasma(elements: PlasmaElements, audio: AudioEngine, callbacks: PlasmaCallbacks): PlasmaController {
  const { screen, contentViewport, contentRoot, closeButton, scene, neonTitle, headerLogo } = elements
  let openTimer: ReturnType<typeof setTimeout> | null = null
  let flashTimer: ReturnType<typeof setTimeout> | null = null
  /** true с первого кадра show() — раньше, чем DOM получает класс .active — чтобы
   * canActivateFace() гарантированно блокировал повторный клик во время анимации открытия. */
  let isOpen = false

  function renderContent(content: PageContent): void {
    contentRoot.innerHTML = ''
    contentViewport.scrollTop = 0

    const titleEl = document.createElement('h1')
    titleEl.className = 'plasma-page-title'
    titleEl.textContent = content.title
    contentRoot.appendChild(titleEl)

    content.blocks.forEach((block, i) => {
      const el = renderBlock(block)
      el.style.animationDelay = `${(i + 1) * BLOCK_REVEAL_STAGGER_MS}ms`
      contentRoot.appendChild(el)
    })
  }

  function show(color: string, content: PageContent): void {
    if (isOpen) return
    isOpen = true
    audio.playPlasmaOpen()
    screen.style.setProperty('--plasma-color', color)
    callbacks.pauseCubeIdleBehaviour()

    // Открыть могли и с прокруткой у футера — поднимаем страницу наверх, чтобы куб/панель
    // и зафиксированный логотип сразу оказались в видимой области.
    window.scrollTo({ top: 0, behavior: 'smooth' })

    if (flashTimer !== null) clearTimeout(flashTimer)
    if (openTimer !== null) clearTimeout(openTimer)

    // Фаза 1: главный куб вспыхивает и сжимается перед тем, как полностью скрыться
    scene.style.transition = 'opacity 0.15s ease, transform 0.4s cubic-bezier(0.55, 0, 0.675, 0.19)'
    scene.style.transform = 'translate(-50%, -50%) scale(1.25)'
    scene.style.opacity = '0.9'
    flashTimer = setTimeout(() => {
      scene.style.transform = 'translate(-50%, -50%) scale(0) rotate(45deg)'
      scene.style.opacity = '0'
    }, 120)

    openTimer = setTimeout(() => {
      scene.style.transition = ''
      scene.style.transform = ''
      scene.style.opacity = ''

      neonTitle.classList.add('hidden')
      headerLogo.classList.remove('hidden')
      scene.classList.add('hidden')
      document.body.classList.add('plasma-open')
      screen.classList.add('active')
      renderContent(content)
    }, 450)
  }

  function hide(): void {
    if (!isOpen) return
    isOpen = false
    audio.playPlasmaClose()
    if (flashTimer !== null) {
      clearTimeout(flashTimer)
      flashTimer = null
    }
    if (openTimer !== null) {
      clearTimeout(openTimer)
      openTimer = null
    }
    callbacks.pauseCubeIdleBehaviour()

    // На случай закрытия ещё во время фазы 1 (вспышка/сжатие) — снять инлайн-стили куба.
    scene.style.transition = ''
    scene.style.transform = ''
    scene.style.opacity = ''

    screen.classList.remove('active')
    scene.classList.remove('hidden')
    document.body.classList.remove('plasma-open')

    headerLogo.classList.add('hidden')
    neonTitle.classList.remove('hidden')

    callbacks.resetCubeRotation()
    callbacks.scheduleCubeAutoRotation()
  }

  closeButton.addEventListener('click', hide)

  return {
    show,
    hide,
    isActive: () => isOpen,
  }
}
