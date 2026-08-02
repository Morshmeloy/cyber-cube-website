import { useState } from 'react'
import { login } from '@/lib/auth.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'
import type { PageNavigationTarget } from '@/types/page-content.tsx'

interface LoginFormProps {
  navigateTo: (target: PageNavigationTarget) => void
}

/** Вход через реальный бэкенд (POST /api/auth/login, см. lib/auth.ts) — JWT
 * access/refresh-токены, а не локально зашитые демо-учётки. */
export function LoginForm({ navigateTo }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = await login(username.trim(), password.trim())
    setIsSubmitting(false)

    if ('user' in result) {
      navigateTo({ private: 'dashboard' })
      return
    }

    setError(
      result.error === 'server-unreachable'
        ? 'Сервер авторизации недоступен. Убедитесь, что backend запущен (порт 8000).'
        : 'Неверный логин или пароль.',
    )
  }

  const fieldClass =
    'w-full rounded-lg border border-[#e8f8ff]/20 bg-[#0a0c18a6] px-3 py-2.5 font-inherit text-[15px] text-[#e8f8ff] transition-[border-color,box-shadow] placeholder:text-[#e8f8ff]/35 focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(0,255,255,0.45)] focus:outline-none'

  return (
    <>
      <div
        className="mx-auto mt-3 max-w-[380px] rounded-2xl border border-cyan-400/40 px-6.5 py-7 shadow-[0_0_24px_rgba(0,255,255,0.25),inset_0_0_24px_rgba(0,0,0,0.2)]"
        style={{ background: 'linear-gradient(160deg, color-mix(in srgb, #0ff 10%, #171b30) 0%, color-mix(in srgb, #0ff 4%, #11101f) 100%)' }}
      >
        <form onSubmit={handleSubmit}>
          <div className="mb-4.5">
            <label htmlFor="username" className="mb-1.5 block text-[13px] font-semibold tracking-wide text-cyan-300 uppercase">
              Логин
            </label>
            <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Введите логин" required className={fieldClass} />
          </div>
          <div className="mb-4.5">
            <label htmlFor="password" className="mb-1.5 block text-[13px] font-semibold tracking-wide text-cyan-300 uppercase">
              Пароль
            </label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Введите пароль" required className={fieldClass} />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-400 bg-cyan-400 py-3.5 text-[15px] font-bold text-[#050510] shadow-[0_0_16px_rgba(0,255,255,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(0,255,255,0.65)] disabled:opacity-60"
          >
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Проверка…' : 'Войти'}
          </button>
          {error && <div className="mt-3.5 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2.5 text-[13px] leading-[1.5] text-red-300">{error}</div>}
        </form>
      </div>
    </>
  )
}
