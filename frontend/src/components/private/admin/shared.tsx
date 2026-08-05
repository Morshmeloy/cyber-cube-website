import axios from 'axios'
import type { RolePermissions } from '@/lib/admin-api.tsx'

export const fieldClass =
  'w-full rounded-md border border-[#e8f8ff]/20 bg-[#0a0c18a6] px-2.5 py-2 font-inherit text-[#e8f8ff] transition-colors focus:border-[var(--plasma-color)] focus:outline-none'
export const labelClass = 'mb-1 block text-xs font-semibold text-[#e8f8ff]/70'
export const selectClass = `${fieldClass} cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg_xmlns=%27http://www.w3.org/2000/svg%27_viewBox=%270_0_24_24%27_fill=%27none%27_stroke=%27%2300ffff%27_stroke-width=%272%27_stroke-linecap=%27round%27_stroke-linejoin=%27round%27%3E%3Cpolyline_points=%276_9_12_15_18_9%27/%3E%3C/svg%3E')] bg-[position:right_10px_center] bg-no-repeat pr-8.5`

export function extractDetail(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail
    if (typeof detail === 'string') return detail
    if (!error.response) return 'Не удалось подключиться к серверу.'
  }
  return fallback
}

export const PERMISSION_FIELDS: { key: keyof RolePermissions; label: string; sensitive?: boolean }[] = [
  { key: 'canViewWarehouse', label: 'Склад — просмотр' },
  { key: 'canManageWarehouseOperations', label: 'Склад — операции' },
  { key: 'canSyncWarehouse1c', label: 'Склад — синхронизация с 1С' },
  { key: 'canManageUsers', label: 'Пользователи — управление', sensitive: true },
  { key: 'canManageRoles', label: 'Роли — управление', sensitive: true },
]

export const EMPTY_PERMISSIONS: RolePermissions = {
  canViewWarehouse: false,
  canManageWarehouseOperations: false,
  canSyncWarehouse1c: false,
  canManageUsers: false,
  canManageRoles: false,
}

/** Тумблер в стиле Дискорда — своя мини-реализация на кнопке, отдельного Switch-компонента
 * в UI-китах проекта нет (только checkbox), а на вид тут нужен именно переключатель. */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5">
      <span className="text-[13px] text-[#e8f8ff]/85">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
          checked ? 'border-[var(--plasma-color)] bg-[var(--plasma-color)]' : 'border-[#e8f8ff]/25 bg-[#0a0c18a6]'
        }`}
      >
        <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-[#050510] transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </button>
    </label>
  )
}

/** Включение прав, близких к админским (управление пользователями/ролями), требует
 * повторного подтверждения — случайный клик не должен молча выдавать такой уровень доступа. */
export function togglePermission(
  current: RolePermissions,
  key: keyof RolePermissions,
  sensitive: boolean | undefined,
  apply: (next: RolePermissions) => void,
): void {
  const turningOn = !current[key]
  if (turningOn && sensitive) {
    const confirmed = window.confirm(
      'Это право даёт доступ к управлению пользователями/ролями — фактически, почти админский уровень доступа. Точно выдать его этой роли?',
    )
    if (!confirmed) return
  }
  apply({ ...current, [key]: !current[key] })
}
