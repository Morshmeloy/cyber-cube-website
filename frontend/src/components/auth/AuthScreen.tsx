import { LoginForm } from './LoginForm.tsx'
import type { PageNavigationTarget } from '@/types/page-content.tsx'

interface AuthScreenProps {
  navigateTo: (target: PageNavigationTarget) => void
}

/** Грань куба «Авторизация» — только вход, саморегистрация отключена (учётки
 * заводит администратор). */
export function AuthScreen({ navigateTo }: AuthScreenProps) {
  return <LoginForm navigateTo={navigateTo} />
}
