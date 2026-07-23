import { useState } from 'react'
import { LoginForm } from './LoginForm.tsx'
import { RegisterForm } from './RegisterForm.tsx'
import type { PageNavigationTarget } from '@/types/page-content.tsx'

interface AuthScreenProps {
  navigateTo: (target: PageNavigationTarget) => void
}

/** Переключатель между формой входа и регистрацией на одной и той же грани куба
 * «Авторизация» — режим держится в локальном состоянии, без отдельной страницы/грани. */
export function AuthScreen({ navigateTo }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')

  return mode === 'login' ? (
    <LoginForm navigateTo={navigateTo} onSwitchToRegister={() => setMode('register')} />
  ) : (
    <RegisterForm navigateTo={navigateTo} onSwitchToLogin={() => setMode('login')} />
  )
}
