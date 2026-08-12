import { useEffect, useState } from 'react'
import { fetchRoles } from '@/lib/admin-api.tsx'
import type { Role } from '@/lib/auth.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'
import { RolesSection } from './admin/RolesSection.tsx'
import { UsersSection } from './admin/UsersSection.tsx'
import { extractDetail } from './admin/shared.tsx'

type Tab = 'roles' | 'users'

/**
 * Скрытая страница администрирования — ссылки на неё нет нигде в интерфейсе, доступна
 * только по прямому переходу на /admin (см. AppRoot.tsx::openAdminPage — там проверка
 * canManageUsers/canManageRoles, не жёсткая привязка к роли admin). Роли — общий список,
 * нужен и вкладке «Роли» (редактирование), и вкладке «Пользователи» (выбор роли при
 * создании/смене), поэтому грузится один раз здесь и передаётся вниз пропом.
 */
export function AdminPage() {
  const [tab, setTab] = useState<Tab>('roles')
  const [roles, setRoles] = useState<Role[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function reloadRoles(): Promise<void> {
    try {
      setRoles(await fetchRoles())
    } catch (err) {
      setError(extractDetail(err, 'Не удалось загрузить список ролей.'))
    }
  }

  useEffect(() => {
    void reloadRoles()
  }, [])

  function tabButtonClass(active: boolean): string {
    return `rounded-lg border px-4 py-2 text-[14px] font-bold transition-colors ${
      active ? 'border-[var(--plasma-color)] bg-[var(--plasma-color)] text-[var(--cab-bg)]' : 'border-[var(--cab-text)]/20 text-[var(--cab-text)]/70 hover:bg-white/6'
    }`
  }

  return (
    <div>
      <div className="mb-5 flex gap-2">
        <button type="button" onClick={() => setTab('roles')} className={tabButtonClass(tab === 'roles')}>
          Роли
        </button>
        <button type="button" onClick={() => setTab('users')} className={tabButtonClass(tab === 'users')}>
          Пользователи
        </button>
      </div>

      {error && <div className="mb-3.5 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2.5 text-[14px] text-red-300">{error}</div>}

      {roles === null ? (
        <div className="flex items-center gap-2 text-sm text-[var(--cab-text)]/70">
          <Spinner className="h-4 w-4" />
          Загрузка…
        </div>
      ) : tab === 'roles' ? (
        <RolesSection roles={roles} onChanged={reloadRoles} />
      ) : (
        <UsersSection roles={roles} />
      )}
    </div>
  )
}
