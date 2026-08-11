import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App.tsx'

// Временная мобильная консоль для отладки лагов куба на телефоне — открывается адресом
// с ?debug=1, без USB/компьютера/пары устройств. Подключается с CDN только по условию,
// в обычный продакшен-бандл не попадает. Убрать после того, как разберёмся с лагами.
type WindowWithEruda = typeof window & {
  eruda?: { init: () => void; add: (plugin: unknown) => void }
  erudaMonitor?: unknown
}
if (new URLSearchParams(window.location.search).has('debug')) {
  const w = window as WindowWithEruda
  const erudaScript = document.createElement('script')
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda'
  erudaScript.onload = () => {
    w.eruda?.init()
    const monitorScript = document.createElement('script')
    monitorScript.src = 'https://cdn.jsdelivr.net/npm/eruda-monitor'
    monitorScript.onload = () => {
      if (w.erudaMonitor) w.eruda?.add(w.erudaMonitor)
    }
    document.body.appendChild(monitorScript)
  }
  document.body.appendChild(erudaScript)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
