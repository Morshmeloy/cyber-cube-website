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
  siteFooterContainer: HTMLElement
}

/** Общие элементы шапки, которые переключает плазменный экран. */
export interface HeaderChromeElements {
  neonTitle: HTMLElement
  headerLogo: HTMLElement
}
