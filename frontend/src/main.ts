import './styles/index.css'
import { initSiteNavigation, type SiteElements } from './navigation/navigation.ts'

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
  plasmaTickerViewport: document.querySelector<HTMLElement>('#plasma-screen .plasma-ticker')!,
  plasmaText: requireElement('plasma-text'),
  plasmaCloseButton: requireElement<HTMLButtonElement>('plasma-close'),
  submenuContainer: requireElement('submenu-container'),
  submenuGroup: requireElement('submenu-cube-group'),
  backButton: requireElement<HTMLButtonElement>('back-button'),
}

initSiteNavigation(elements)
