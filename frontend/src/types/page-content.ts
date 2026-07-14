import type { FaceName } from './navigation.ts'

/** Переключение на другую страницу сайта внутри плазмы: грань куба или «Правовая информация»
 * (у неё своей грани нет, см. settings/navigation/pages/legal.ts). */
export type PageNavigationTarget = { face: FaceName } | { legal: true }

/** Куда ведёт ссылка/кнопка внутри контента страницы — то же самое переключение, либо
 * внешний/статический файл (открывается в новой вкладке обычной ссылкой, не через плазму). */
export type PageLinkTarget = PageNavigationTarget | { href: string }

/** Один структурный блок содержимого страницы грани куба. */
export type PageBlock =
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  /** Абзац с одной встроенной ссылкой посередине текста — переход на другую страницу сайта. */
  | { kind: 'paragraphLink'; before: string; linkText: string; after: string; target: PageLinkTarget }
  | { kind: 'list'; items: string[] }
  | { kind: 'cardGrid'; cards: { title: string; text: string }[] }
  | { kind: 'imageGallery'; images: { src: string; alt: string }[] }
  | { kind: 'contactInfo'; lines: string[] }
  /** Ряд кнопок-переходов на другие страницы сайта (аналог кнопок на исходном сайте). */
  | { kind: 'linkButtons'; buttons: { label: string; target: PageLinkTarget }[] }

/** Контент одной страницы грани — заголовок и последовательность блоков. */
export interface PageContent {
  title: string
  blocks: PageBlock[]
}
