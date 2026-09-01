import { useEffect, useState } from 'react'
import { createUser, fetchUsers, setUserActive, updateUserRole, type AdminUser } from '@/lib/admin-api.tsx'
import { getUser, type Role } from '@/lib/auth.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'
import { PasswordInput } from '@/components/auth/PasswordInput.tsx'
import { extractDetail, fieldClass, labelClass, selectClass } from './shared.tsx'

interface UsersSectionProps {
  roles: Role[]
}

interface NewUserDraft {
  username: string
  email: string
  password: string
  fullName: string
  roleId: number | ''
}

const EMPTY_DRAFT: NewUserDraft = { username: '', email: '', password: '', fullName: '', roleId: '' }

export function UsersSection({ roles }: UsersSectionProps) {
  const viewerIsSystem = getUser()?.role.isSystem ?? false

  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<NewUserDraft>(EMPTY_DRAFT)
  const [submitting, setSubmitting] = useState(false)

  async function reload(): Promise<void> {
    try {
      setUsers(await fetchUsers())
    } catch (err) {
      setError(extractDetail(err, 'Не удалось загрузить список пользователей.'))
    }
  }

  useEffect(() => {
    // Запускаем начальную загрузку после синхронной фазы эффекта: reload обновляет
    // React-state и не должен провоцировать каскадный рендер прямо из тела эффекта.
    queueMicrotask(() => void reload())
  }, [])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (!draft.roleId) return
    setSubmitting(true)
    setError(null)
    try {
      await createUser({
        username: draft.username.trim(),
        email: draft.email.trim(),
        password: draft.password,
        roleId: draft.roleId,
        fullName: draft.fullName.trim(),
      })
      setDraft(EMPTY_DRAFT)
      setCreating(false)
      await reload()
    } catch (err) {
      setError(extractDetail(err, 'Не удалось создать пользователя.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRoleChange(id: number, roleId: number): Promise<void> {
    setBusyId(id)
    setError(null)
    try {
      const updated = await updateUserRole(id, roleId)
      setUsers((prev) => prev?.map((u) => (u.id === id ? updated : u)) ?? null)
    } catch (err) {
      setError(extractDetail(err, 'Не удалось изменить роль пользователя.'))
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
    } catch (err) {
      setError(extractDetail(err, 'Не удалось изменить статус пользователя.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      {error && <div className="mb-3.5 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2.5 text-[14px] text-red-300">{error}</div>}

      {!users ? (
        <div className="mb-4 flex items-center gap-2 text-sm text-[var(--cab-text)]/70">
          <Spinner className="h-4 w-4" />
          Загрузка пользователей…
        </div>
      ) : (
        <div
          className="mb-4 overflow-x-auto rounded-xl border p-4"
          style={{ background: 'color-mix(in srgb, var(--plasma-color) 6%, var(--cab-panel))', borderColor: 'color-mix(in srgb, var(--plasma-color) 16%, transparent)' }}
        >
          <table className="w-full min-w-[720px] border-collapse text-[16px] text-[var(--cab-text)]/85">
            <thead>
              <tr>
                {['Логин', 'Email', 'Имя', 'Роль', 'Статус'].map((h) => (
                  <th key={h} className="bg-white/6 px-2.5 py-2 text-left font-bold text-[var(--plasma-color)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const busy = busyId === u.id
                // Менять администратора может только сам администратор — см. AdminService.update_user
                // на бэке; тут просто заранее блокируем контролы, чтобы не показывать ошибку 403.
                const locked = u.role.isSystem && !viewerIsSystem
                return (
                  <tr key={u.id} className="hover:bg-white/4">
                    <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2 font-semibold">{u.username}</td>
                    <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2 text-[var(--cab-text)]/70">{u.email}</td>
                    <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2 text-[var(--cab-text)]/70">{u.fullName ?? '—'}</td>
                    <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">
                      <select
                        value={u.role.id}
                        disabled={busy || locked}
                        onChange={(e) => void handleRoleChange(u.id, Number(e.target.value))}
                        className={`${selectClass} py-1.5`}
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id} className="bg-[var(--cab-field-bg)]">
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">
                      <button
                        type="button"
                        disabled={busy || locked}
                        onClick={() => void handleToggleActive(u.id, !u.isActive)}
                        className={`rounded-full border px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50 ${
                          u.isActive ? 'border-[var(--cab-success)]/40 text-[var(--cab-success)] hover:bg-[var(--cab-success)]/10' : 'border-[var(--cab-danger)]/40 text-[var(--cab-danger)] hover:bg-[var(--cab-danger)]/10'
                        }`}
                      >
                        {u.isActive ? 'Активен' : 'Заблокирован'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2.5 py-4 text-center text-[var(--cab-text)]/50">
                    Пользователей пока нет.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {creating ? (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="max-w-[420px] rounded-xl border p-4"
          style={{ background: 'color-mix(in srgb, var(--plasma-color) 7%, var(--cab-panel-form))', borderColor: 'color-mix(in srgb, var(--plasma-color) 20%, transparent)' }}
        >
          <div className="mb-3">
            <label className={labelClass}>Логин</label>
            <input type="text" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} required className={fieldClass} />
          </div>
          <div className="mb-3">
            <label className={labelClass}>Email</label>
            <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} required className={fieldClass} />
          </div>
          <div className="mb-3">
            <label className={labelClass}>Пароль</label>
            <PasswordInput
              name="new-password"
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              autoComplete="new-password"
              required
              className={fieldClass}
            />
          </div>
          <div className="mb-3">
            <label className={labelClass}>Имя (необязательно)</label>
            <input type="text" value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} className={fieldClass} />
          </div>
          <div className="mb-3.5">
            <label className={labelClass}>Роль</label>
            <select
              value={draft.roleId}
              onChange={(e) => setDraft({ ...draft, roleId: Number(e.target.value) })}
              required
              className={selectClass}
            >
              <option value="" disabled className="bg-[var(--cab-field-bg)]">
                Выбери роль
              </option>
              {roles.map((role) => (
                <option key={role.id} value={role.id} className="bg-[var(--cab-field-bg)]">
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg border border-[var(--plasma-color)] bg-[var(--plasma-color)] px-4 py-2 text-[14px] font-bold text-[var(--cab-bg)] disabled:opacity-60"
            >
              {submitting && <Spinner className="h-3.5 w-3.5" />}
              Создать
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-lg border border-[var(--cab-text)]/20 px-4 py-2 text-[14px] text-[var(--cab-text)]/70 transition-colors hover:bg-white/6"
            >
              Отмена
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-lg border border-[var(--plasma-color)] px-4 py-2 text-[14px] font-bold text-[var(--plasma-color)] transition-colors hover:bg-[color-mix(in_srgb,var(--plasma-color)_15%,transparent)]"
        >
          + Новый пользователь
        </button>
      )}
    </div>
  )
}
