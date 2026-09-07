import type { FaceName } from '@/types/navigation.tsx'
import type { PageNavigationTarget, PrivatePageKey } from '@/types/page-content.tsx'

/**
 * Лёгкая синхронизация адресной строки с текущей открытой страницей — без роутера
 * (react-router-dom в проекте намеренно не используется, вся навигация и так стекается
 * в один диспетчер navigateTo() в AppRoot.tsx). AppRoute — то, что реально может быть
 * открыто: куб (ничего не открыто), обычная навигация (грань/легальная/раздел кабинета)
 * или скрытая админ-страница — она не часть PageNavigationTarget специально: на неё нет
 * ссылок нигде в интерфейсе, попасть можно только прямым переходом по /admin.
 */
export type AppRoute = { kind: 'cube' } | { kind: 'nav'; target: PageNavigationTarget } | { kind: 'admin' }

const FACE_TO_SLUG: Record<FaceName, string> = {
  front: 'login',
  back: 'about',
  right: 'services',
  left: 'software',
  top: 'support',
  bottom: 'contacts',
}

const SLUG_TO_FACE: Record<string, FaceName> = Object.fromEntries(Object.entries(FACE_TO_SLUG).map(([face, slug]) => [slug, face])) as Record<string, FaceName>

const PRIVATE_KEYS: PrivatePageKey[] = ['dashboard', 'learning', 'warehouse', 'docs', 'finance']

/** Маршрут → URL. Один и тот же путь может быть результатом разных запросов (например,
 * попытка открыть приватный раздел неавторизованным всегда приводит на /login) — вызывающий
 * код (AppRoot.tsx) сам решает, какой AppRoute реально получился, и просит синхронизировать URL под него. */
export function pathForRoute(route: AppRoute): string {
  if (route.kind === 'cube') return '/'
  if (route.kind === 'admin') return '/admin'
  const { target } = route
  if ('legal' in target) return '/legal'
  if ('private' in target) return `/${target.private}`
  return `/${FACE_TO_SLUG[target.face]}`
}

/** URL → маршрут. Вызывается при первой загрузке страницы (deep link) и на кнопки
 * назад/вперёд браузера. Незнакомый путь тихо трактуется как куб — не ломает приложение. */
export function routeForPath(pathname: string): AppRoute {
  const slug = pathname.replace(/^\/+|\/+$/g, '').toLowerCase()
  if (slug === '') return { kind: 'cube' }
  if (slug === 'admin') return { kind: 'admin' }
  if (slug === 'legal') return { kind: 'nav', target: { legal: true } }
  if ((PRIVATE_KEYS as string[]).includes(slug)) return { kind: 'nav', target: { private: slug as PrivatePageKey } }
  if (slug in SLUG_TO_FACE) return { kind: 'nav', target: { face: SLUG_TO_FACE[slug] } }
  return { kind: 'cube' }
}
