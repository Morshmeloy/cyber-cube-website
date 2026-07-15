export interface SiteElements {
  bgLayerA: HTMLElement
  bgLayerB: HTMLElement
  rainContainer: HTMLElement
  trailContainer: HTMLElement
  neonTitle: HTMLElement
  headerLogoCanvas: HTMLCanvasElement
  scene: HTMLElement
  cube: HTMLDivElement
  plasmaScreen: HTMLElement
  plasmaContentViewport: HTMLElement
  plasmaContentRoot: HTMLElement
  plasmaCloseButton: HTMLButtonElement
  plasmaExpandButton: HTMLButtonElement
  siteFooterContainer: HTMLElement
  /** Виджет профиля в правом верхнем углу — вне плазменной панели, виден на любом экране. */
  userMenuContainer: HTMLElement
}

/** Общие элементы шапки, которые переключает плазменный экран. */
export interface HeaderChromeElements {
  neonTitle: HTMLElement
  headerLogo: HTMLElement
}
