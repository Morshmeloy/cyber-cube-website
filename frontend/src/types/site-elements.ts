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
  plasmaTickerViewport: HTMLElement
  plasmaText: HTMLElement
  plasmaCloseButton: HTMLButtonElement
  submenuContainer: HTMLElement
  submenuGroup: HTMLElement
  backButton: HTMLButtonElement
}

/** Общие элементы шапки, которые переключают и подменю, и плазменный экран. */
export interface HeaderChromeElements {
  neonTitle: HTMLElement
  headerLogo: HTMLElement
  backButton: HTMLElement
}
