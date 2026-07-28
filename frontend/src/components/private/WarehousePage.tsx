import { useEffect, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { getUser } from '@/lib/auth.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'
import {
  fetchNomenclature,
  fetchOperations,
  fetchAuditLog,
  createOperation,
  updateOperation,
  deleteOperation,
  syncFrom1c,
  fetchSyncStatus,
  exportOperations,
  type Nomenclature,
  type StockOperation,
  type AuditLogEntry,
  type OperationType,
} from '@/lib/warehouse-api.tsx'

const fieldClass =
  'w-full rounded-md border border-[#e8f8ff]/20 bg-[#0a0c18a6] px-2.5 py-2 font-inherit text-[#e8f8ff] transition-colors focus:border-[var(--plasma-color)] focus:outline-none'
const labelClass = 'mb-1 block text-xs font-semibold text-[#e8f8ff]/70'
const selectClass = `${fieldClass} cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg_xmlns=%27http://www.w3.org/2000/svg%27_viewBox=%270_0_24_24%27_fill=%27none%27_stroke=%27%2300ffff%27_stroke-width=%272%27_stroke-linecap=%27round%27_stroke-linejoin=%27round%27%3E%3Cpolyline_points=%276_9_12_15_18_9%27/%3E%3C/svg%3E')] bg-[position:right_10px_center] bg-no-repeat pr-8.5`
const secondaryButtonClass =
  'flex items-center gap-1.5 rounded-md border border-[#e8f8ff]/20 px-2.5 py-1.5 text-[12px] text-[#e8f8ff]/80 transition-colors hover:bg-white/6 disabled:opacity-50'

function formatDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Устаревание данных (п. 5.4.2 ТЗ) показываем не порогом/предупреждением, а самим
 * прошедшим временем — пользователь сам решает, насколько это давно. */
function formatSyncStatus(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return 'Ещё не синхронизировано с 1С'
  const diffMs = Date.now() - new Date(lastSyncedAt).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Последняя синхронизация: меньше минуты назад'
  if (minutes < 60) return `Последняя синхронизация: ${minutes} мин. назад`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Последняя синхронизация: ${hours} ч. назад`
  const days = Math.floor(hours / 24)
  return `Последняя синхронизация: ${days} дн. назад`
}

function operationLabel(type: OperationType): string {
  return type === 'issue' ? '📤 Выдача' : '📥 Возврат'
}

function operationTypeWord(type: unknown): string {
  return type === 'return' ? 'возврат' : 'выдача'
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 403) return 'Только администратор может выполнять это действие.'
    if (error.response?.status === 422) {
      const detail = (error.response.data as { detail?: unknown } | undefined)?.detail
      if (typeof detail === 'string') return detail
      return 'Проверьте введённые данные.'
    }
    if (!error.response) return 'Не удалось подключиться к серверу.'
  }
  return fallback
}

/** Человекочитаемое описание записи журнала аудита — action/entity_type/JSON из БД
 * не показываем напрямую, собираем из них обычное русское предложение. */
function describeAuditEntry(entry: AuditLogEntry): string {
  const details = (entry.details ?? {}) as Record<string, unknown>
  switch (entry.action) {
    case 'nomenclature_synced':
      return `Синхронизировал номенклатуру и остатки с 1С — добавлено ${details.added ?? 0}, обновлено ${details.updated ?? 0} (всего в 1С: ${details.total ?? 0}).`
    case 'nomenclature_exported':
      return `Экспортировал историю операций (${details.count ?? 0} записей).`
    case 'operation_created':
      return `Добавил операцию: ${operationTypeWord(details.operation_type)} «${details.nomenclature ?? '—'}», ${details.quantity ?? '?'} шт.`
    case 'operation_updated': {
      const before = (details.before ?? {}) as Record<string, unknown>
      return `Изменил операцию — до правки было: ${operationTypeWord(before.operation_type)} «${before.nomenclature ?? '—'}», ${before.quantity ?? '?'} шт., ${before.person ?? ''}.`
    }
    case 'operation_deleted':
      return `Удалил операцию: ${operationTypeWord(details.operation_type)} «${details.nomenclature ?? '—'}», ${details.quantity ?? '?'} шт., ${details.person ?? ''}.`
    default:
      return entry.action
  }
}

interface OperationDraft {
  name: string
  quantity: string
  operationType: OperationType
  person: string
  destination: string
}

const EMPTY_DRAFT: OperationDraft = { name: '', quantity: '', operationType: 'issue', person: '', destination: '' }

interface EditDraft {
  quantity: string
  operationType: OperationType
  person: string
  destination: string
}

/** Складской учёт по ТЗ: номенклатура и базовые остатки приходят из 1С через ручной
 * импорт Excel (src/services/excel_service.py на бэкенде), операции выдачи/возврата
 * ведутся на портале. Полный CRUD операций и импорт/редактирование — только у admin,
 * у остальных ролей — чтение и экспорт (см. src/services/warehouse_service.py). */
export function WarehousePage() {
  const isAdmin = getUser()?.role === 'admin'

  const [nomenclature, setNomenclature] = useState<Nomenclature[] | null>(null)
  const [operations, setOperations] = useState<StockOperation[] | null>(null)
  const [auditLog, setAuditLog] = useState<AuditLogEntry[] | null>(null)
  const [showAudit, setShowAudit] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [exportingKey, setExportingKey] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [savingEditId, setSavingEditId] = useState<number | null>(null)

  const [draft, setDraft] = useState<OperationDraft>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)

  async function loadData(): Promise<void> {
    setRefreshing(true)
    try {
      const [nextNomenclature, nextOperations, nextSyncStatus] = await Promise.all([
        fetchNomenclature(),
        fetchOperations(),
        fetchSyncStatus(),
      ])
      setNomenclature(nextNomenclature)
      setOperations(nextOperations)
      setLastSyncedAt(nextSyncStatus.lastSyncedAt)
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось загрузить данные склада.'))
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadData()
    })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    const trimmedName = draft.name.trim()
    const trimmedPerson = draft.person.trim()
    const trimmedDestination = draft.destination.trim()
    const qty = Number(draft.quantity)
    if (!trimmedName || !draft.quantity || Number.isNaN(qty) || !trimmedPerson || !trimmedDestination) return

    if (draft.operationType === 'issue') {
      const match = nomenclature?.find((item) => normalizeName(item.name) === normalizeName(trimmedName))
      const available = match?.totalQuantity ?? 0
      if (qty > available) {
        toast.error(`Недостаточно товара на складе: доступно ${available}, запрошено ${qty}.`)
        return
      }
    }

    setSubmitting(true)
    try {
      await createOperation({
        nomenclatureName: trimmedName,
        quantity: qty,
        operationType: draft.operationType,
        person: trimmedPerson,
        destination: trimmedDestination,
      })
      setDraft(EMPTY_DRAFT)
      await loadData()
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось создать операцию.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSync(): Promise<void> {
    setSyncing(true)
    try {
      const result = await syncFrom1c()
      toast.success(`Синхронизация завершена: добавлено ${result.added}, обновлено ${result.updated}.`)
      await loadData()
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось синхронизироваться с 1С.'))
    } finally {
      setSyncing(false)
    }
  }

  async function handleExportOperations(): Promise<void> {
    setExportingKey('operations')
    try {
      await exportOperations()
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось выгрузить файл.'))
    } finally {
      setExportingKey(null)
    }
  }

  async function handleDelete(id: number): Promise<void> {
    setDeletingId(id)
    try {
      await deleteOperation(id)
      await loadData()
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось удалить операцию.'))
    } finally {
      setDeletingId(null)
    }
  }

  function startEdit(operation: StockOperation): void {
    setEditingId(operation.id)
    setEditDraft({
      quantity: String(operation.quantity),
      operationType: operation.operationType,
      person: operation.person,
      destination: operation.destination,
    })
  }

  function cancelEdit(): void {
    setEditingId(null)
    setEditDraft(null)
  }

  async function saveEdit(id: number): Promise<void> {
    if (!editDraft) return
    const qty = Number(editDraft.quantity)
    if (!editDraft.quantity || Number.isNaN(qty)) return

    const original = operations?.find((op) => op.id === id)
    const match = original ? nomenclature?.find((item) => item.id === original.nomenclatureId) : undefined
    if (original && match) {
      const oldEffect = original.operationType === 'return' ? original.quantity : -original.quantity
      const newEffect = editDraft.operationType === 'return' ? qty : -qty
      const totalAfter = match.totalQuantity - oldEffect + newEffect
      if (totalAfter < 0) {
        toast.error(`После изменения остаток станет отрицательным (${totalAfter}).`)
        return
      }
    }

    setSavingEditId(id)
    try {
      await updateOperation(id, {
        quantity: qty,
        operationType: editDraft.operationType,
        person: editDraft.person.trim(),
        destination: editDraft.destination.trim(),
      })
      cancelEdit()
      await loadData()
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось изменить операцию.'))
    } finally {
      setSavingEditId(null)
    }
  }

  async function toggleAudit(): Promise<void> {
    const next = !showAudit
    setShowAudit(next)
    if (next && auditLog === null) {
      try {
        setAuditLog(await fetchAuditLog())
      } catch (error) {
        toast.error(extractErrorMessage(error, 'Не удалось загрузить журнал аудита.'))
      }
    }
  }

  const nomenclatureNames = nomenclature?.map((item) => item.name) ?? []

  return (
    <div>
      {isAdmin && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="mb-5.5 max-w-[520px] rounded-xl border p-4.5"
          style={{ background: 'color-mix(in srgb, var(--plasma-color) 7%, #171b30)', borderColor: 'color-mix(in srgb, var(--plasma-color) 20%, transparent)' }}
        >
          <h3 className="mb-3 text-sm font-bold text-[var(--plasma-color)] [text-shadow:0_0_6px_color-mix(in_srgb,var(--plasma-color)_50%,transparent)]">Добавить операцию</h3>
          <div className="mb-3">
            <label className={labelClass}>Номенклатура</label>
            <input
              type="text"
              list="nomenclature-options"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Название товара"
              required
              className={fieldClass}
            />
            <datalist id="nomenclature-options">
              {nomenclatureNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="mb-3">
            <label className={labelClass}>Количество</label>
            <input
              type="number"
              value={draft.quantity}
              onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
              required
              className={fieldClass}
            />
          </div>
          <div className="mb-3">
            <label className={labelClass}>Тип операции</label>
            <select
              value={draft.operationType}
              onChange={(e) => setDraft({ ...draft, operationType: e.target.value as OperationType })}
              className={selectClass}
            >
              <option value="issue">Выдача</option>
              <option value="return">Возврат</option>
            </select>
          </div>
          <div className="mb-3">
            <label className={labelClass}>ФИО сотрудника</label>
            <input
              type="text"
              value={draft.person}
              onChange={(e) => setDraft({ ...draft, person: e.target.value })}
              placeholder="ФИО"
              required
              className={fieldClass}
            />
          </div>
          <div className="mb-3">
            <label className={labelClass}>Адрес/место назначения</label>
            <input
              type="text"
              value={draft.destination}
              onChange={(e) => setDraft({ ...draft, destination: e.target.value })}
              placeholder="Куда/откуда"
              required
              className={fieldClass}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg border border-[var(--plasma-color)] bg-[var(--plasma-color)] px-5 py-2.5 font-bold text-[#050510] disabled:opacity-60"
          >
            {submitting && <Spinner className="h-4 w-4" />}
            Сохранить
          </button>
        </form>
      )}

      <div
        className="mb-5.5 overflow-x-auto rounded-xl border p-4"
        style={{ background: 'color-mix(in srgb, var(--plasma-color) 6%, #14172c)', borderColor: 'color-mix(in srgb, var(--plasma-color) 16%, transparent)' }}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[var(--plasma-color)]">Остатки по номенклатуре</h3>
            <p className="text-[11px] text-[#e8f8ff]/50">{formatSyncStatus(lastSyncedAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadData()} disabled={refreshing} className={secondaryButtonClass}>
              {refreshing && <Spinner className="h-3.5 w-3.5" />}
              Обновить
            </button>
            {isAdmin && (
              <button type="button" onClick={() => void handleSync()} disabled={syncing} className={secondaryButtonClass}>
                {syncing && <Spinner className="h-3.5 w-3.5" />}
                Обновить данные из 1С
              </button>
            )}
          </div>
        </div>

        {nomenclature === null ? (
          <div className="flex items-center gap-2 py-4 text-sm text-[#e8f8ff]/70">
            <Spinner className="h-4 w-4" />
            Загрузка…
          </div>
        ) : (
          <table className="w-full min-w-[620px] border-collapse text-[13px] text-[#e8f8ff]/85">
            <thead>
              <tr>
                {['Номенклатура', 'Остаток из 1С', 'Движение через портал', 'Итоговый остаток'].map((h) => (
                  <th key={h} className="bg-white/6 px-2.5 py-2 text-left font-bold text-[var(--plasma-color)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nomenclature.map((item) => (
                <tr key={item.id} className="hover:bg-white/4">
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{item.name}</td>
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{item.baseQuantity}</td>
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{item.portalQuantity > 0 ? `+${item.portalQuantity}` : item.portalQuantity}</td>
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2 font-bold">{item.totalQuantity}</td>
                </tr>
              ))}
              {nomenclature.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2.5 py-4 text-center text-[#e8f8ff]/50">
                    Номенклатуры пока нет — нажми «Обновить данные из 1С».
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div
        className="mb-5.5 overflow-x-auto rounded-xl border p-4"
        style={{ background: 'color-mix(in srgb, var(--plasma-color) 6%, #14172c)', borderColor: 'color-mix(in srgb, var(--plasma-color) 16%, transparent)' }}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[var(--plasma-color)]">История операций</h3>
          <button type="button" onClick={() => void handleExportOperations()} disabled={exportingKey === 'operations'} className={secondaryButtonClass}>
            {exportingKey === 'operations' && <Spinner className="h-3.5 w-3.5" />}
            Экспорт операций
          </button>
        </div>

        {operations === null ? (
          <div className="flex items-center gap-2 py-4 text-sm text-[#e8f8ff]/70">
            <Spinner className="h-4 w-4" />
            Загрузка…
          </div>
        ) : (
          <table className="w-full min-w-[820px] border-collapse text-[13px] text-[#e8f8ff]/85">
            <thead>
              <tr>
                {['Дата', 'Номенклатура', 'Тип', 'Кол-во', 'ФИО', 'Адрес/место назначения', 'Кто ввёл', ...(isAdmin ? ['Действия'] : [])].map((h) => (
                  <th key={h} className="bg-white/6 px-2.5 py-2 text-left font-bold text-[var(--plasma-color)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {operations.map((op) => {
                const isEditing = editingId === op.id
                return (
                  <tr key={op.id} className="hover:bg-white/4">
                    <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{formatDate(op.createdAt)}</td>
                    <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{op.nomenclatureName}</td>
                    <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">
                      {isEditing && editDraft ? (
                        <select
                          value={editDraft.operationType}
                          onChange={(e) => setEditDraft({ ...editDraft, operationType: e.target.value as OperationType })}
                          className={`${selectClass} py-1`}
                        >
                          <option value="issue">Выдача</option>
                          <option value="return">Возврат</option>
                        </select>
                      ) : (
                        operationLabel(op.operationType)
                      )}
                    </td>
                    <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">
                      {isEditing && editDraft ? (
                        <input
                          type="number"
                          value={editDraft.quantity}
                          onChange={(e) => setEditDraft({ ...editDraft, quantity: e.target.value })}
                          className={`${fieldClass} w-24 py-1`}
                        />
                      ) : (
                        op.quantity
                      )}
                    </td>
                    <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">
                      {isEditing && editDraft ? (
                        <input
                          type="text"
                          value={editDraft.person}
                          onChange={(e) => setEditDraft({ ...editDraft, person: e.target.value })}
                          className={`${fieldClass} py-1`}
                        />
                      ) : (
                        op.person
                      )}
                    </td>
                    <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">
                      {isEditing && editDraft ? (
                        <input
                          type="text"
                          value={editDraft.destination}
                          onChange={(e) => setEditDraft({ ...editDraft, destination: e.target.value })}
                          className={`${fieldClass} py-1`}
                        />
                      ) : (
                        op.destination
                      )}
                    </td>
                    <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{op.username}</td>
                    {isAdmin && (
                      <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">
                        {isEditing ? (
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={savingEditId === op.id}
                              onClick={() => void saveEdit(op.id)}
                              className="flex items-center gap-1 rounded-md border border-[var(--plasma-color)] px-2 py-1 text-[11px] text-[var(--plasma-color)] disabled:opacity-50"
                            >
                              {savingEditId === op.id && <Spinner className="h-3 w-3" />}
                              Сохранить
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded-md border border-[#e8f8ff]/20 px-2 py-1 text-[11px] text-[#e8f8ff]/70"
                            >
                              Отмена
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEdit(op)}
                              className="rounded-md border border-[#e8f8ff]/20 px-2.5 py-1 text-[11px] text-[#e8f8ff]/80 transition-colors hover:bg-white/6"
                            >
                              Изменить
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === op.id}
                              onClick={() => void handleDelete(op.id)}
                              className="flex items-center gap-1.5 rounded-md border border-red-400/35 px-2.5 py-1 text-[11px] text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                            >
                              {deletingId === op.id && <Spinner className="h-3 w-3" />}
                              Удалить
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
              {operations.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-2.5 py-4 text-center text-[#e8f8ff]/50">
                    Операций пока нет.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isAdmin && (
        <div
          className="overflow-x-auto rounded-xl border p-4"
          style={{ background: 'color-mix(in srgb, var(--plasma-color) 6%, #14172c)', borderColor: 'color-mix(in srgb, var(--plasma-color) 16%, transparent)' }}
        >
          <button type="button" onClick={() => void toggleAudit()} className={secondaryButtonClass}>
            {showAudit ? 'Скрыть журнал аудита' : 'Показать журнал аудита'}
          </button>

          {showAudit && (
            <div className="mt-3.5">
              {auditLog === null ? (
                <div className="flex items-center gap-2 py-2 text-sm text-[#e8f8ff]/70">
                  <Spinner className="h-4 w-4" />
                  Загрузка…
                </div>
              ) : (
                <table className="w-full min-w-[640px] border-collapse text-[13px] text-[#e8f8ff]/85">
                  <thead>
                    <tr>
                      {['Дата', 'Пользователь', 'Что сделал'].map((h) => (
                        <th key={h} className="bg-white/6 px-2.5 py-2 text-left font-bold text-[var(--plasma-color)]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((entry) => (
                      <tr key={entry.id} className="hover:bg-white/4">
                        <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2 whitespace-nowrap">{formatDate(entry.createdAt)}</td>
                        <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2 whitespace-nowrap">{entry.username}</td>
                        <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{describeAuditEntry(entry)}</td>
                      </tr>
                    ))}
                    {auditLog.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-2.5 py-4 text-center text-[#e8f8ff]/50">
                          Журнал пуст.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
