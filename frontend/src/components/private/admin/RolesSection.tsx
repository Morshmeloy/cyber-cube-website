import { useState } from 'react'
import { createRole, deleteRole, updateRole, type RolePermissions } from '@/lib/admin-api.tsx'
import type { Role } from '@/lib/auth.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'
import { EMPTY_PERMISSIONS, PERMISSION_FIELDS, Toggle, extractDetail, fieldClass, labelClass, togglePermission } from './shared.tsx'

interface RoleFormProps {
  initialName: string
  initialPermissions: RolePermissions
  submitLabel: string
  busy: boolean
  onSubmit: (name: string, permissions: RolePermissions) => void
  onCancel: () => void
}

function RoleForm({ initialName, initialPermissions, submitLabel, busy, onSubmit, onCancel }: RoleFormProps) {
  const [name, setName] = useState(initialName)
  const [permissions, setPermissions] = useState<RolePermissions>(initialPermissions)

  return (
    <div>
      <div className="mb-3">
        <label className={labelClass}>Название роли</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Кладовщик" className={fieldClass} />
      </div>
      <div className="mb-3.5">
        {PERMISSION_FIELDS.map((f) => (
          <Toggle key={f.key} label={f.label} checked={permissions[f.key]} onChange={() => togglePermission(permissions, f.key, f.sensitive, setPermissions)} />
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => onSubmit(name.trim(), permissions)}
          className="flex items-center gap-2 rounded-lg border border-[var(--plasma-color)] bg-[var(--plasma-color)] px-4 py-2 text-[13px] font-bold text-[#050510] disabled:opacity-60"
        >
          {busy && <Spinner className="h-3.5 w-3.5" />}
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-[#e8f8ff]/20 px-4 py-2 text-[13px] text-[#e8f8ff]/70 transition-colors hover:bg-white/6">
          Отмена
        </button>
      </div>
    </div>
  )
}

interface RolesSectionProps {
  roles: Role[]
  onChanged: () => Promise<void>
}

export function RolesSection({ roles, onChanged }: RolesSectionProps) {
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(name: string, permissions: RolePermissions): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await createRole(name, permissions)
      setCreating(false)
      await onChanged()
    } catch (err) {
      setError(extractDetail(err, 'Не удалось создать роль.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdate(id: number, name: string, permissions: RolePermissions): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await updateRole(id, name, permissions)
      setEditingId(null)
      await onChanged()
    } catch (err) {
      setError(extractDetail(err, 'Не удалось изменить роль.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(role: Role): Promise<void> {
    if (!window.confirm(`Удалить роль «${role.name}»?`)) return
    setBusy(true)
    setError(null)
    try {
      await deleteRole(role.id)
      await onChanged()
    } catch (err) {
      setError(extractDetail(err, 'Не удалось удалить роль.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {error && <div className="mb-3.5 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-300">{error}</div>}

      <div className="mb-4 space-y-3">
        {roles.map((role) => (
          <div
            key={role.id}
            className="rounded-xl border p-4"
            style={{ background: 'color-mix(in srgb, var(--plasma-color) 6%, #14172c)', borderColor: 'color-mix(in srgb, var(--plasma-color) 16%, transparent)' }}
          >
            {editingId === role.id ? (
              <RoleForm
                initialName={role.name}
                initialPermissions={role}
                submitLabel="Сохранить"
                busy={busy}
                onSubmit={(name, permissions) => void handleUpdate(role.id, name, permissions)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[var(--plasma-color)]">{role.name}</span>
                    {role.isSystem && (
                      <span className="rounded-full border border-[var(--plasma-color)] px-2 py-0.5 text-[10px] font-bold text-[var(--plasma-color)]">Системная</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {PERMISSION_FIELDS.filter((f) => role[f.key]).map((f) => (
                      <span key={f.key} className="rounded-full border border-[#e8f8ff]/20 px-2 py-0.5 text-[11px] text-[#e8f8ff]/70">
                        {f.label}
                      </span>
                    ))}
                    {PERMISSION_FIELDS.every((f) => !role[f.key]) && <span className="text-[11px] text-[#e8f8ff]/40">Без прав</span>}
                  </div>
                </div>
                {!role.isSystem && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(role.id)}
                      className="rounded-md border border-[#e8f8ff]/20 px-2.5 py-1.5 text-[12px] text-[#e8f8ff]/80 transition-colors hover:bg-white/6"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDelete(role)}
                      className="rounded-md border border-red-400/35 px-2.5 py-1.5 text-[12px] text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                    >
                      Удалить
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {creating ? (
        <div
          className="max-w-[420px] rounded-xl border p-4"
          style={{ background: 'color-mix(in srgb, var(--plasma-color) 7%, #171b30)', borderColor: 'color-mix(in srgb, var(--plasma-color) 20%, transparent)' }}
        >
          <RoleForm
            initialName=""
            initialPermissions={EMPTY_PERMISSIONS}
            submitLabel="Создать"
            busy={busy}
            onSubmit={(name, permissions) => void handleCreate(name, permissions)}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-lg border border-[var(--plasma-color)] px-4 py-2 text-[13px] font-bold text-[var(--plasma-color)] transition-colors hover:bg-[color-mix(in_srgb,var(--plasma-color)_15%,transparent)]"
        >
          + Новая роль
        </button>
      )}
    </div>
  )
}
