interface SpinnerProps {
  className?: string
}

/** Универсальный индикатор загрузки для реальных сетевых запросов (вход/регистрация,
 * раздел «Обучение» — статус ИИ-модели, объяснения ошибок, чат с учителем). Цвет —
 * currentColor, чтобы наследоваться от текста/акцента места использования. */
export function Spinner({ className = 'h-4 w-4' }: SpinnerProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${className} animate-spin`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
