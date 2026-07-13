import { FOOTER_TAGLINE, FOOTER_NAV_ITEMS, FOOTER_CONTACT_LINES, FOOTER_LEGAL_LINES, FOOTER_CREDIT_LINE } from '../settings/site/footer.ts'
import { SITE_NAME, LOGO_MARK_IMAGE_PATH } from '../settings/site/site.ts'
import { faceColors } from '../settings/navigation/faces.ts'
import type { FaceName } from '../types/navigation.ts'

export interface FooterCallbacks {
  onNavigate(face: FaceName): void
}

/** Строит общий футер сайта (лого, навигация по граням куба, контакты, реквизиты). */
export function createSiteFooter(container: HTMLElement, callbacks: FooterCallbacks): void {
  container.innerHTML = `
    <div class="site-footer-grid">
      <div class="site-footer-brand">
        <img class="site-footer-logo" src="${LOGO_MARK_IMAGE_PATH}" alt="${SITE_NAME}" />
        <p>${FOOTER_TAGLINE}</p>
      </div>
      <div class="site-footer-col">
        <h3>Навигация</h3>
        <nav class="site-footer-nav" aria-label="Навигация по сайту"></nav>
      </div>
      <div class="site-footer-col">
        <h3>Контакты</h3>
        <div class="site-footer-contacts"></div>
      </div>
    </div>
    <div class="site-footer-legal"></div>
    <div class="site-footer-credit"></div>
  `

  const nav = container.querySelector<HTMLElement>('.site-footer-nav')!
  for (const item of FOOTER_NAV_ITEMS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = item.label
    button.style.setProperty('--nav-color', faceColors[item.face])
    button.addEventListener('click', () => callbacks.onNavigate(item.face))
    nav.appendChild(button)
  }

  const contacts = container.querySelector<HTMLElement>('.site-footer-contacts')!
  for (const line of FOOTER_CONTACT_LINES) {
    const p = document.createElement('p')
    const labelEl = document.createElement('span')
    labelEl.textContent = `${line.label}: `
    p.appendChild(labelEl)
    if (line.href) {
      const a = document.createElement('a')
      a.href = line.href
      a.textContent = line.value
      p.appendChild(a)
    } else {
      p.appendChild(document.createTextNode(line.value))
    }
    contacts.appendChild(p)
  }

  const legal = container.querySelector<HTMLElement>('.site-footer-legal')!
  for (const line of FOOTER_LEGAL_LINES) {
    const p = document.createElement('p')
    if (line.emphasis) p.classList.add('site-footer-legal-emphasis')
    if (line.href) {
      const a = document.createElement('a')
      a.href = line.href
      a.target = '_blank'
      a.rel = 'noopener'
      a.textContent = line.text
      p.appendChild(a)
    } else {
      p.textContent = line.text
    }
    legal.appendChild(p)
  }

  const credit = container.querySelector<HTMLElement>('.site-footer-credit')!
  credit.textContent = FOOTER_CREDIT_LINE
}
