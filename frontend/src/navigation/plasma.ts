import type { AudioEngine } from '../types/audio.ts'
import type { PlasmaElements, PlasmaCallbacks, PlasmaController, PlasmaShowOptions } from '../types/plasma.ts'
import type { PageBlock, PageContent, PageLinkTarget, PageNavigationTarget } from '../types/page-content.ts'
import { BLOCK_REVEAL_STAGGER_MS } from '../settings/navigation/plasma.ts'
import { createImageCarousel } from './certificate-carousel.ts'

/** Кликабельный элемент для PageLinkTarget: реальная <a target="_blank"> для внешних/файловых
 * ссылок (просмотр PDF в новой вкладке перед скачиванием), иначе <button> на переключение
 * контента внутри плазмы (грань куба или «Правовая информация»). */
function createLinkTrigger(
  target: PageLinkTarget,
  label: string,
  className: string,
  navigateTo: (target: PageNavigationTarget) => void,
): HTMLElement {
  if ('href' in target) {
    const a = document.createElement('a')
    a.href = target.href
    a.target = '_blank'
    a.rel = 'noopener'
    a.className = className
    a.textContent = label
    return a
  }
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.textContent = label
  button.addEventListener('click', () => navigateTo(target))
  return button
}

function renderBlock(block: PageBlock, navigateTo: (target: PageNavigationTarget) => void): HTMLElement {
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
    case 'paragraphLink': {
      const el = document.createElement('p')
      el.className = 'plasma-block plasma-paragraph'
      el.append(document.createTextNode(block.before))
      el.appendChild(createLinkTrigger(block.target, block.linkText, 'plasma-inline-link', navigateTo))
      el.append(document.createTextNode(block.after))
      return el
    }
    case 'linkButtons': {
      const el = document.createElement('div')
      el.className = 'plasma-block plasma-link-buttons'
      block.buttons.forEach((btn, i) => {
        const className = i === 0 ? 'plasma-cta plasma-cta-primary' : 'plasma-cta plasma-cta-outline'
        el.appendChild(createLinkTrigger(btn.target, btn.label, className, navigateTo))
      })
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
        cardEl.appendChild(titleEl)
        if (card.text) {
          const textEl = document.createElement('p')
          textEl.textContent = card.text
          cardEl.appendChild(textEl)
        }
        if (card.items && card.items.length > 0) {
          const itemsEl = document.createElement('ul')
          itemsEl.className = 'plasma-card-items'
          for (const item of card.items) {
            const itemEl = document.createElement('li')
            itemEl.textContent = item
            itemsEl.appendChild(itemEl)
          }
          cardEl.appendChild(itemsEl)
        }
        if (card.tags && card.tags.length > 0) {
          const tagsEl = document.createElement('div')
          tagsEl.className = 'plasma-card-tags'
          for (const tag of card.tags) {
            const tagEl = document.createElement('span')
            tagEl.className = 'plasma-tag'
            tagEl.textContent = tag
            tagsEl.appendChild(tagEl)
          }
          cardEl.appendChild(tagsEl)
        }
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
    case 'contactForm':
      return createContactForm(block.heading, block.recipientEmail)
    case 'map': {
      const el = document.createElement('div')
      el.className = 'plasma-block plasma-map'
      const iframe = document.createElement('iframe')
      iframe.src = block.embedUrl
      iframe.title = block.title
      iframe.loading = 'lazy'
      iframe.allowFullscreen = true
      el.appendChild(iframe)
      return el
    }
    case 'custom': {
      const el = document.createElement('div')
      el.className = 'plasma-block'
      el.appendChild(block.render({ navigateTo }))
      return el
    }
  }
}

/** Форма обратной связи. Бэкенда для тихой отправки нет, поэтому по сабмиту формируется
 * mailto: со связкой имя/email/тема/сообщение — открывается почтовый клиент пользователя
 * с уже готовым письмом, вместо фиктивной отправки в никуда. */
function createContactForm(heading: string, recipientEmail: string): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'plasma-block plasma-form-wrapper'

  const title = document.createElement('div')
  title.className = 'plasma-form-heading'
  title.textContent = heading
  wrapper.appendChild(title)

  const form = document.createElement('form')
  form.className = 'plasma-form'
  form.noValidate = true

  function addField(labelText: string, input: HTMLInputElement | HTMLTextAreaElement): void {
    const field = document.createElement('div')
    field.className = 'plasma-form-field'
    const label = document.createElement('label')
    label.textContent = labelText
    label.htmlFor = input.id
    field.append(label, input)
    form.appendChild(field)
  }

  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.id = 'plasma-form-name'
  nameInput.placeholder = 'Иван Иванов'
  nameInput.required = true
  addField('Ваше имя', nameInput)

  const emailInput = document.createElement('input')
  emailInput.type = 'email'
  emailInput.id = 'plasma-form-email'
  emailInput.placeholder = 'ivan@example.com'
  emailInput.required = true
  addField('Ваш Email', emailInput)

  const subjectInput = document.createElement('input')
  subjectInput.type = 'text'
  subjectInput.id = 'plasma-form-subject'
  subjectInput.placeholder = 'Тема вашего сообщения'
  addField('Тема', subjectInput)

  const messageInput = document.createElement('textarea')
  messageInput.id = 'plasma-form-message'
  messageInput.rows = 5
  messageInput.placeholder = 'Введите ваше сообщение здесь...'
  messageInput.required = true
  addField('Сообщение', messageInput)

  const status = document.createElement('p')
  status.className = 'plasma-form-status'

  const submitButton = document.createElement('button')
  submitButton.type = 'submit'
  submitButton.className = 'plasma-cta plasma-cta-primary plasma-form-submit'
  submitButton.textContent = 'Отправить'
  form.appendChild(submitButton)

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    if (!form.reportValidity()) return

    const subject = subjectInput.value.trim() || 'Сообщение с сайта'
    const body = `Имя: ${nameInput.value.trim()}\nEmail: ${emailInput.value.trim()}\n\n${messageInput.value.trim()}`
    const mailtoUrl = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = mailtoUrl

    status.textContent = `Открываем ваш почтовый клиент с готовым письмом. Если он не открылся, напишите нам напрямую на ${recipientEmail}.`
  })

  wrapper.append(form, status)
  return wrapper
}

/** Создаёт плазменный информационный экран — полноразмерную панель страницы грани куба. */
export function createPlasma(elements: PlasmaElements, audio: AudioEngine, callbacks: PlasmaCallbacks): PlasmaController {
  const { screen, contentViewport, contentRoot, closeButton, scene, neonTitle, headerLogo } = elements
  let openTimer: ReturnType<typeof setTimeout> | null = null
  let flashTimer: ReturnType<typeof setTimeout> | null = null
  /** true с первого кадра show() — раньше, чем DOM получает класс .active — чтобы
   * canActivateFace() гарантированно блокировал повторный клик во время анимации открытия. */
  let isOpen = false
  /** Действие крестика для текущего показа — по умолчанию null (обычное hide() к кубу),
   * переопределяется опцией show() (разделы личного кабинета ведут на дашборд). */
  let closeOverride: (() => void) | null = null

  function renderContent(content: PageContent): void {
    contentRoot.innerHTML = ''
    contentViewport.scrollTop = 0

    // Пустой title — страница сама рисует свой заголовок в первом блоке (личный кабинет).
    if (content.title) {
      const titleEl = document.createElement('h1')
      titleEl.className = 'plasma-page-title'
      titleEl.textContent = content.title
      contentRoot.appendChild(titleEl)
    }

    content.blocks.forEach((block, i) => {
      const el = renderBlock(block, callbacks.navigateTo)
      el.style.animationDelay = `${(i + 1) * BLOCK_REVEAL_STAGGER_MS}ms`
      contentRoot.appendChild(el)
    })
  }

  /** Переключение на другую страницу, когда панель уже открыта — без анимации куба,
   * просто короткий перекрёстный переход контента (это то, чем пользуется навигация в футере). */
  function switchContent(color: string, content: PageContent): void {
    audio.playPlasmaOpen()
    window.scrollTo({ top: 0, behavior: 'smooth' })

    contentRoot.style.transition = 'opacity 0.18s ease'
    contentRoot.style.opacity = '0'
    setTimeout(() => {
      screen.style.setProperty('--plasma-color', color)
      renderContent(content)
      contentRoot.style.opacity = '1'
    }, 180)
  }

  function show(color: string, content: PageContent, options?: PlasmaShowOptions): void {
    closeOverride = options?.onClose ?? null
    if (isOpen) {
      switchContent(color, content)
      return
    }
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
      // cube.ts прописывает курсор куба напрямую как inline-стиль (grab/grabbing) —
      // он имеет приоритет над CSS-правилом body.plasma-open, поэтому сбрасываем его здесь.
      document.body.style.cursor = ''
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

  closeButton.addEventListener('click', () => {
    if (closeOverride) closeOverride()
    else hide()
  })

  return {
    show,
    hide,
    isActive: () => isOpen,
  }
}
