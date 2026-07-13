/** Имя одной из шести граней главного куба навигации. */
export type FaceName = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom'

export const FACE_NAMES: readonly FaceName[] = ['front', 'back', 'right', 'left', 'top', 'bottom']

export interface CubeFaceDefinition {
  name: FaceName
  /** HTML-разметка иконки грани (SVG-контур или canvas для логотипа). */
  iconHtml: string
  label: string
  /** Более подробное описание для aria-label; если не задано, используется label. */
  ariaLabel?: string
}

/** Пункт навигации в общем футере сайта — ведёт на страницу той же грани куба. */
export interface FooterNavItem {
  label: string
  face: FaceName
}
