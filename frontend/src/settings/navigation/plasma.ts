import type { FaceName } from '../../types/navigation.ts'

export const TYPEWRITER_CHAR_DELAY_MS = 30

/** Временный контент плазменного экрана до появления реальных страниц-разделов. */
export function buildPlaceholderContent(index: number, faceName: FaceName): string {
  return `Подменю ${index} — ${faceName}\n\nЗдесь будет контент для элемента ${index}`
}
