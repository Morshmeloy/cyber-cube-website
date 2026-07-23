import { useEffect, useState } from 'react'
import { fetchAllUsers, updateUserRole, setUserActive, deleteUser, type AdminUser } from '@/lib/admin-api.tsx'
import { ROLE_LABELS } from '@/data/navigation/private.tsx'
import type { UserRole } from '@/lib/auth.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'

const ROLE_OPTIONS: UserRole[] = ['admin', 'engineer', 'accountant']

const fieldClass = `cursor-pointer appearance-none rounded-md border border-[#e8f8ff]/20 bg-[#0a0c18a6] px-2.5 py-1.5 pr-7 font-inherit text-[13px] text-[#e8f8ff] transition-colors focus:border-[var(--plasma-color)] focus:outline-none bg-[url('data:image/svg+xml,%3Csvg_xmlns=%27http://www.w3.org/2000/svg%27_viewBox=%270_0_24_24%27_fill=%27none%27_stroke=%27%2300ffff%27_stroke-width=%272%27_stroke-linecap=%27round%27_stroke-linejoin=%27round%27%3E%3Cpolyline_points=%276_9_12_15_18_9%27/%3E%3C/svg%3E')] bg-[position:right_6px_center] bg-no-repeat`

/**
 * Скрытая страница администрирования — ссылки на неё нет нигде в интерфейсе, доступна
 * только по прямому переходу на /admin (см. lib/router.ts, AppRoot.tsx::openAdminPage —
 * там же проверка роли: попасть могут только пользователи с ролью admin). Список
 * пользователей, смена роли/активности и удаление — всё на заглушке lib/admin-api.ts,
 * реального бэкенд-эндпоинта для управления пользователями пока нет.
 */
export function AdminPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAllUsers()
      .then(setUsers)
      .catch(() => setError('Не удалось загрузить список пользователей.'))
  }, [])

  async function handleRoleChange(id: number, role: UserRole): Promise<void> {
    setBusyId(id)
    setError(null)
    try {
      const updated = await updateUserRole(id, role)
      setUsers((prev) => prev?.map((u) => (u.id === id ? updated : u)) ?? null)
    } catch {
      setError('Не удалось изменить роль пользователя.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleActive(id: number, nextActive: boolean): Promise<void> {
    setBusyId(id)
    setError(null)
    try {
      const updated = await setUserActive(id, nextActive)
      setUsers((prev) => prev?.map((u) => (u.id === id ? updated : u)) ?? null)
    } catch {
      setError('Не удалось изменить статус пользователя.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(id: number, username: string): Promise<void> {
    if (!window.confirm(`Удалить пользователя «${username}»? Действие необратимо (в рамках этой сессии).`)) return
    setBusyId(id)
    setError(null)
    try {
      await deleteUser(id)
      setUsers((prev) => prev?.filter((u) => u.id !== id) ?? null)
    } catch {
      setError('Не удалось удалить пользователя.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="mb-4.5 rounded-lg border border-[#ff4757]/35 bg-[#ff475714] px-4 py-2.5 text-[13px] text-[#ff9a9a]">
        ⚠ Служебный раздел — управление пользователями пока работает на заглушке
        (lib/admin-api.ts): список и изменения живут только в памяти вкладки и сбрасываются
        при перезагрузке страницы, реального бэкенд-эндпоинта ещё нет.
      </div>

      {error && <div className="mb-3.5 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-300">{error}</div>}

      {!users ? (
        <div className="flex items-center gap-2 text-sm text-[#e8f8ff]/70">
          <Spinner className="h-4 w-4" />
          Загрузка пользователей…
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-xl border p-4"
          style={{ background: 'color-mix(in srgb, var(--plasma-color) 6%, #14172c)', borderColor: 'color-mix(in srgb, var(--plasma-color) 16%, transparent)' }}
        >
          <table className="w-full min-w-[720px] border-collapse text-[13px] text-[#e8f8ff]/85">
            <thead>
              <tr>
                {['Логин', 'Email', 'Имя', 'Роль', 'Статус', 'Действия'].map((h) => (
                  <th key={h} className="bg-white/6 px-2.5 py-2 text-left font-bold text-[var(--plasma-color)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const busy = busyId === u.id
                return (
                  <tr key={u.id} className="hover:bg-white/4">
                    <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2 font-semibold">{u.username}</td>
                    <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2 text-[#e8f8ff]/70">{u.email}</td>
                    <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2 text-[#e8f8ff]/70">{u.fullName ?? '—'}</td>
                    <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">
                      <select value={u.role} disabled={busy} onChange={(e) => void handleRoleChange(u.id, e.target.value as UserRole)} className={fieldClass}>
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role} className="bg-[#0a0c18]">
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleToggleActive(u.id, !u.isActive)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50 ${
                          u.isActive ? 'border-[#6ee7a0]/40 text-[#6ee7a0] hover:bg-[#6ee7a01a]' : 'border-[#ff8080]/40 text-[#ff8080] hover:bg-[#ff80801a]'
                        }`}
                      >
                        {u.isActive ? 'Активен' : 'Заблокирован'}
                      </button>
                    </td>
                    <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDelete(u.id, u.username)}
                        className="flex items-center gap-1.5 rounded-md border border-red-400/35 px-2.5 py-1.5 text-[11px] text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                      >
                        {busy && <Spinner className="h-3 w-3" />}
                        Удалить
                      </button>
                    </td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2.5 py-4 text-center text-[#e8f8ff]/50">
                    Пользователей не осталось.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
