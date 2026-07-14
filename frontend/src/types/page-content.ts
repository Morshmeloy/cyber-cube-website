import type { FaceName } from './navigation.ts'

/** Куда ведёт ссылка/кнопка внутри контента страницы — на грань куба или на страницу
 * «Правовая информация» (у неё своей грани нет, см. settings/navigation/pages/legal.ts). */
export type PageLinkTarget = { face: FaceName } | { legal: true }

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
