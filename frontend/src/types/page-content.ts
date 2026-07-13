/** Один структурный блок содержимого страницы грани куба. */
export type PageBlock =
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'cardGrid'; cards: { title: string; text: string }[] }
  | { kind: 'imageGallery'; images: { src: string; alt: string }[] }
  | { kind: 'contactInfo'; lines: string[] }

/** Контент одной страницы грани — заголовок и последовательность блоков. */
export interface PageContent {
  title: string
  blocks: PageBlock[]
}
