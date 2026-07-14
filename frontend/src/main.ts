import './styles/index.css'
import { initSiteNavigation } from './navigation/navigation.ts'
import type { SiteElements } from './types/site-elements.ts'

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Не найден элемент #${id} в index.html`)
  return el as T
}

const elements: SiteElements = {
  bgLayerA: requireElement('bg-layer-a'),
  bgLayerB: requireElement('bg-layer-b'),
  rainContainer: requireElement('rain'),
  trailContainer: requireElement('trails'),
  neonTitle: requireElement('neon-title'),
  headerLogoCanvas: requireElement<HTMLCanvasElement>('header-logo'),
  scene: requireElement('scene-el'),
  cube: requireElement<HTMLDivElement>('cube'),
  plasmaScreen: requireElement('plasma-screen'),
  plasmaContentViewport: requireElement('plasma-content-viewport'),
  plasmaContentRoot: requireElement('plasma-content-root'),
  plasmaCloseButton: requireElement<HTMLButtonElement>('plasma-close'),
  siteFooterContainer: requireElement('site-footer'),
  userMenuContainer: requireElement('user-menu'),
}

initSiteNavigation(elements)
