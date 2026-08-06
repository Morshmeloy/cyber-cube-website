import axios from 'axios'

export const fieldClass =
  'w-full rounded-md border border-[#e8f8ff]/20 bg-[#0a0c18a6] px-2.5 py-2 font-inherit text-[#e8f8ff] transition-colors focus:border-[var(--plasma-color)] focus:outline-none'
export const labelClass = 'mb-1 block text-xs font-semibold text-[#e8f8ff]/70'
export const selectClass = `${fieldClass} cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg_xmlns=%27http://www.w3.org/2000/svg%27_viewBox=%270_0_24_24%27_fill=%27none%27_stroke=%27%2300ffff%27_stroke-width=%272%27_stroke-linecap=%27round%27_stroke-linejoin=%27round%27%3E%3Cpolyline_points=%276_9_12_15_18_9%27/%3E%3C/svg%3E')] bg-[position:right_10px_center] bg-no-repeat pr-8.5`
export const secondaryButtonClass =
  'flex items-center gap-1.5 rounded-md border border-[#e8f8ff]/20 px-2.5 py-1.5 text-[12px] text-[#e8f8ff]/80 transition-colors hover:bg-white/6 disabled:opacity-50'
export const panelClass = 'mb-5.5 overflow-x-auto rounded-xl border p-4'
export const panelStyle = {
  background: 'color-mix(in srgb, var(--plasma-color) 6%, #14172c)',
  borderColor: 'color-mix(in srgb, var(--plasma-color) 16%, transparent)',
}
export const formPanelStyle = {
  background: 'color-mix(in srgb, var(--plasma-color) 7%, #171b30)',
  borderColor: 'color-mix(in srgb, var(--plasma-color) 20%, transparent)',
}
/** Режим «Листать вниз» — таблица остаётся в рамке такой же высоты, что и постранично
 * (примерно под 10 строк), прокрутка/подгрузка идёт ВНУТРИ неё, страница не растёт. */
export const scrollBoxClass = 'max-h-[440px] overflow-y-auto'

export function formatDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 403) return 'Недостаточно прав для этого действия.'
    if (error.response?.status === 422) {
      const detail = (error.response.data as { detail?: unknown } | undefined)?.detail
      if (typeof detail === 'string') return detail
      return 'Проверьте введённые данные.'
    }
    if (!error.response) return 'Не удалось подключиться к серверу.'
  }
  return fallback
}
