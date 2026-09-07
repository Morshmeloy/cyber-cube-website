import type { ReactNode } from 'react'
import type { FaceName } from './navigation.tsx'

/** Ключ одной из приватных страниц личного кабинета (доступны только после входа). */
export type PrivatePageKey = 'dashboard' | 'learning' | 'warehouse' | 'docs' | 'finance'

/** Переключение на другую страницу сайта внутри плазмы: грань куба, «Правовая информация»
 * (у неё своей грани нет, см. settings/navigation/pages/legal.ts) или страница личного кабинета. */
export type PageNavigationTarget = { face: FaceName } | { legal: true } | { private: PrivatePageKey }

/** Куда ведёт ссылка/кнопка внутри контента страницы — то же самое переключение, либо
 * внешний/статический файл (открывается в новой вкладке обычной ссылкой, не через плазму). */
export type PageLinkTarget = PageNavigationTarget | { href: string }

/** Один структурный блок содержимого страницы грани куба. */
export type PageBlock =
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  /** Абзац с одной встроенной ссылкой посередине текста — переход на другую страницу сайта. */
  | { kind: 'paragraphLink'; before: string; linkText: string; after: string; target: PageLinkTarget }
  /** Абзац с одним выделенным фрагментом посередине текста (не ссылка) — например,
   * номер лицензии/сертификата, который нужно подчеркнуть визуально. */
  | { kind: 'paragraphEmphasis'; before: string; emphasisText: string; after: string }
  | { kind: 'list'; items: string[] }
  /** text — один абзац; items — то же самое, но каждый пункт с новой строки (для перечислений
   * вида «label — описание»); tags — короткие бейджи под текстом (коды ОКВЭД и т.п.). */
  | { kind: 'cardGrid'; cards: { title: string; text?: string; items?: string[]; tags?: string[] }[] }
  | { kind: 'imageGallery'; images: { src: string; alt: string }[] }
  | { kind: 'contactInfo'; lines: string[] }
  /** Ряд кнопок-переходов на другие страницы сайта (аналог кнопок на исходном сайте). */
  | { kind: 'linkButtons'; buttons: { label: string; target: PageLinkTarget }[] }
  /** Форма обратной связи. Бэкенда нет — отправка идёт через mailto: (открывает
   * почтовый клиент пользователя с готовым письмом), а не тихой отправкой на сервер. */
  | { kind: 'contactForm'; heading: string; recipientEmail: string }
  /** Встроенная карта (iframe), как на исходном сайте — обычно Яндекс.Карты. */
  | { kind: 'map'; embedUrl: string; title: string }
  /** Произвольный DOM-узел (формы, таблицы, iframe) для страниц личного кабинета, ещё не
   * переведённых на React. navigateTo — переход внутри плазмы. Мост через ref в PageRenderer —
   * см. CustomBlockBridge. Постепенно вытесняется 'component' по мере переноса кабинета. */
  | { kind: 'custom'; render: (ctx: { navigateTo: (target: PageNavigationTarget) => void }) => HTMLElement }
  /** То же самое, но для уже переведённых на React разделов — рендерится напрямую как JSX,
   * без моста через HTMLElement. */
  | { kind: 'component'; render: (ctx: { navigateTo: (target: PageNavigationTarget) => void }) => ReactNode }

/** Контент одной страницы грани — заголовок и последовательность блоков. */
export interface PageContent {
  title: string
  blocks: PageBlock[]
}
