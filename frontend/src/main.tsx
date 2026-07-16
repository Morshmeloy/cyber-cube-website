import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Старые стили ещё не переведены на Tailwind (см. этап финальной стилизации) —
// подключены как есть, чтобы куб/панель/футер выглядели без регрессий до рефреша.
import './styles/index.css'
import { App } from './app/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
