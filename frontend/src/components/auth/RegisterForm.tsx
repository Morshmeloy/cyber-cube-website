import { useState } from 'react'
import { register, type RegisterError, type UserRole } from '@/lib/auth.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'
import type { PageNavigationTarget } from '@/types/page-content.tsx'

interface RegisterFormProps {
  navigateTo: (target: PageNavigationTarget) => void
  onSwitchToLogin: () => void
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'engineer', label: 'Инженер' },
  { value: 'accountant', label: 'Бухгалтер' },
  { value: 'admin', label: 'Администратор' },
]

const ERROR_MESSAGES: Record<RegisterError, string> = {
  'username-taken': 'Такой логин уже занят.',
  'email-taken': 'Этот email уже зарегистрирован.',
  'invalid-data': 'Проверьте правильность заполнения формы.',
  'server-unreachable': 'Сервер авторизации недоступен. Убедитесь, что backend запущен (порт 8000).',
}

/** Форма регистрации нового пользователя — та же грань «Авторизация», что и вход
 * (переключение между ними — см. AuthScreen.tsx). После успешной регистрации сразу
 * выполняется вход тем же логином/паролем (см. lib/auth.ts::register). */
export function RegisterForm({ navigateTo, onSwitchToLogin }: RegisterFormProps) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('engineer')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = await register({
      username: username.trim(),
      email: email.trim(),
      password,
      fullName: fullName.trim() || undefined,
      role,
    })
    setIsSubmitting(false)

    if ('user' in result) {
      navigateTo({ private: 'dashboard' })
      return
    }
    setError(ERROR_MESSAGES[result.error])
  }

  const fieldClass =
    'w-full rounded-lg border border-[#e8f8ff]/20 bg-[#0a0c18a6] px-3 py-2.5 font-inherit text-[15px] text-[#e8f8ff] transition-[border-color,box-shadow] placeholder:text-[#e8f8ff]/35 focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(0,255,255,0.45)] focus:outline-none'
  const labelClass = 'mb-1.5 block text-[13px] font-semibold tracking-wide text-cyan-300 uppercase'

  return (
    <div
      className="mx-auto mt-3 max-w-[380px] rounded-2xl border border-cyan-400/40 px-6.5 py-7 shadow-[0_0_24px_rgba(0,255,255,0.25),inset_0_0_24px_rgba(0,0,0,0.2)]"
      style={{ background: 'linear-gradient(160deg, color-mix(in srgb, #0ff 10%, #171b30) 0%, color-mix(in srgb, #0ff 4%, #11101f) 100%)' }}
    >
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="reg-username" className={labelClass}>
            Логин
          </label>
          <input id="reg-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Придумайте логин" required className={fieldClass} />
        </div>
        <div className="mb-4">
          <label htmlFor="reg-email" className={labelClass}>
            Email
          </label>
          <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className={fieldClass} />
        </div>
        <div className="mb-4">
          <label htmlFor="reg-password" className={labelClass}>
            Пароль
          </label>
          <input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Не менее 8 символов" required minLength={8} className={fieldClass} />
        </div>
        <div className="mb-4">
          <label htmlFor="reg-full-name" className={labelClass}>
            Полное имя (необязательно)
          </label>
          <input id="reg-full-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иван Иванов" className={fieldClass} />
        </div>
        <div className="mb-4.5">
          <label htmlFor="reg-role" className={labelClass}>
            Роль
          </label>
          <select
            id="reg-role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className={`${fieldClass} cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg_xmlns=%27http://www.w3.org/2000/svg%27_viewBox=%270_0_24_24%27_fill=%27none%27_stroke=%27%2300ffff%27_stroke-width=%272%27_stroke-linecap=%27round%27_stroke-linejoin=%27round%27%3E%3Cpolyline_points=%276_9_12_15_18_9%27/%3E%3C/svg%3E')] bg-[position:right_10px_center] bg-no-repeat pr-8.5`}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#0a0c18] text-[#e8f8ff]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-400 bg-cyan-400 py-3.5 text-[15px] font-bold text-[#050510] shadow-[0_0_16px_rgba(0,255,255,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(0,255,255,0.65)] disabled:opacity-60"
        >
          {isSubmitting && <Spinner />}
          {isSubmitting ? 'Регистрация…' : 'Зарегистрироваться'}
        </button>
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="mt-2.5 w-full rounded-lg border border-[#e8f8ff]/20 bg-transparent py-2.5 text-[13px] text-[#e8f8ff]/80 transition-colors hover:border-cyan-400 hover:text-cyan-300"
        >
          Уже есть аккаунт? Войти
        </button>
        {error && <div className="mt-3.5 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2.5 text-[13px] leading-[1.5] text-red-300">{error}</div>}
      </form>
    </div>
  )
}
