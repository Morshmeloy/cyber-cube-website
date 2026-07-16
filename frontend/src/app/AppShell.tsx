import { useEffect, useRef } from 'react'
import { initSiteNavigation } from '@/navigation/navigation.ts'
import { startNetworkCanvas } from '@/background/network-canvas.ts'
import type { SiteElements } from '@/types/site-elements.ts'

/**
 * React владеет только разметкой (JSX ниже воспроизводит index.html 1:1) — вся
 * бизнес-логика (куб, плазменная панель, футер, виджет профиля, фон, дождь, звук)
 * остаётся нетронутой в navigation.ts и вызывается через refs, как раньше через
 * getElementById. StrictMode-guard нужен, потому что initSiteNavigation вешает
 * document-level слушатели и строит DOM граней без своей функции очистки —
 * повторный вызов в дев-режиме продублировал бы грани куба и обработчики drag.
 */
export function AppShell() {
  const bgLayerA = useRef<HTMLDivElement>(null)
  const bgLayerB = useRef<HTMLDivElement>(null)
  const rainContainer = useRef<HTMLDivElement>(null)
  const trailContainer = useRef<HTMLDivElement>(null)
  const neonTitle = useRef<HTMLHeadingElement>(null)
  const headerLogoCanvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<HTMLDivElement>(null)
  const cube = useRef<HTMLDivElement>(null)
  const plasmaScreen = useRef<HTMLDivElement>(null)
  const plasmaContentViewport = useRef<HTMLDivElement>(null)
  const plasmaContentRoot = useRef<HTMLDivElement>(null)
  const plasmaCloseButton = useRef<HTMLButtonElement>(null)
  const plasmaExpandButton = useRef<HTMLButtonElement>(null)
  const siteFooterContainer = useRef<HTMLDivElement>(null)
  const userMenuContainer = useRef<HTMLDivElement>(null)
  const networkCanvas = useRef<HTMLCanvasElement>(null)

  const didInit = useRef(false)

  useEffect(() => {
    const stopNetworkCanvas = networkCanvas.current ? startNetworkCanvas(networkCanvas.current) : undefined
    return () => stopNetworkCanvas?.()
  }, [])

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true

    const elements: SiteElements = {
      bgLayerA: bgLayerA.current!,
      bgLayerB: bgLayerB.current!,
      rainContainer: rainContainer.current!,
      trailContainer: trailContainer.current!,
      neonTitle: neonTitle.current!,
      headerLogoCanvas: headerLogoCanvas.current!,
      scene: scene.current!,
      cube: cube.current!,
      plasmaScreen: plasmaScreen.current!,
      plasmaContentViewport: plasmaContentViewport.current!,
      plasmaContentRoot: plasmaContentRoot.current!,
      plasmaCloseButton: plasmaCloseButton.current!,
      plasmaExpandButton: plasmaExpandButton.current!,
      siteFooterContainer: siteFooterContainer.current!,
      userMenuContainer: userMenuContainer.current!,
    }

    initSiteNavigation(elements)
  }, [])

  return (
    <>
      <div className="cyber-substation">
        <div ref={bgLayerA} className="bg-layer active" style={{ backgroundImage: "url('/images/fon1.jpg')" }} />
        <div ref={bgLayerB} className="bg-layer hidden" />
        <div className="bg-overlay" />
      </div>

      <div ref={rainContainer} className="rain-container" />
      <div ref={trailContainer} className="rain-container" />

      <div ref={userMenuContainer} className="user-menu" />

      <div className="viewport-hero">
        <h1 ref={neonTitle} className="neon-title" data-text="Д4 Технологии">
          Д4 Технологии
        </h1>
        <canvas ref={headerLogoCanvas} className="site-logo hidden" aria-label="Д4 Технологии" />

        <div ref={scene} className="scene">
          <div ref={cube} className="cube" />
        </div>

        <div ref={plasmaScreen} className="plasma-screen" aria-label="Информация о разделе">
          <div className="plasma-bg" />
          <canvas ref={networkCanvas} className="plasma-network-canvas" />
          <div className="plasma-scanlines" />
          <div ref={plasmaContentViewport} className="plasma-content">
            <div ref={plasmaContentRoot} className="plasma-content-root" />
          </div>
          <div className="plasma-glare" />
          <button ref={plasmaExpandButton} type="button" className="plasma-expand" aria-label="На весь экран" />
          <button ref={plasmaCloseButton} type="button" className="plasma-close" aria-label="Закрыть">
            &times;
          </button>
        </div>
      </div>

      <footer ref={siteFooterContainer} className="site-footer" />
    </>
  )
}
