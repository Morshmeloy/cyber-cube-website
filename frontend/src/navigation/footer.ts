import { FOOTER_TAGLINE, FOOTER_NAV_ITEMS, FOOTER_CONTACT_LINES, FOOTER_LEGAL_LINES } from '../settings/site/footer.ts'
import { SITE_NAME, LOGO_IMAGE_PATH } from '../settings/site/site.ts'
import type { FaceName } from '../types/navigation.ts'

export interface FooterCallbacks {
  onNavigate(face: FaceName): void
}

/** Строит общий футер сайта (лого, навигация по граням куба, контакты, реквизиты). */
export function createSiteFooter(container: HTMLElement, callbacks: FooterCallbacks): void {
  container.innerHTML = `
    <div class="site-footer-grid">
      <div class="site-footer-brand">
        <img class="site-footer-logo" src="${LOGO_IMAGE_PATH}" alt="${SITE_NAME}" />
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
  `

  const nav = container.querySelector<HTMLElement>('.site-footer-nav')!
  for (const item of FOOTER_NAV_ITEMS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = item.label
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
    p.textContent = line
    legal.appendChild(p)
  }
}
