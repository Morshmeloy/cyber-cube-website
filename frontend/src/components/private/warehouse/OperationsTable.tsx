import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  fetchOperations,
  updateOperation,
  deleteOperation,
  confirmOperationsIn1c,
  unconfirmOperationIn1c,
  type StockOperation,
  type OperationType,
} from '@/lib/warehouse-api.tsx'
import { usePaginatedList } from '@/hooks/usePaginatedList.tsx'
import { PaginationBar } from './PaginationBar.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'
import { fieldClass, formatDate, labelClass, panelClass, panelStyle, extractErrorMessage, scrollBoxClass, selectClass } from './shared.tsx'

function operationLabel(type: OperationType): string {
  return type === 'issue' ? '📤 Выдача' : '📥 Возврат'
}

interface EditDraft {
  quantity: string
  operationType: OperationType
  person: string
  destination: string
}

interface OperationsTableProps {
  refreshToken: number
  canManageOps: boolean
  onDataChanged: () => void
}

export function OperationsTable({ refreshToken, canManageOps, onDataChanged }: OperationsTableProps) {
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [operationType, setOperationType] = useState<OperationType | ''>('')
  const [person, setPerson] = useState('')
  const [destination, setDestination] = useState('')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [savingEditId, setSavingEditId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const filterKey = `${query}|${dateFrom}|${dateTo}|${operationType}|${person}|${destination}|${refreshToken}`

  const { mode, setMode, page, setPage, totalPages, items, total, loading } = usePaginatedList<StockOperation>(
    (p, pageSize) =>
      fetchOperations({
        query,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        operationType: operationType || undefined,
        person: person || undefined,
        destination: destination || undefined,
        page: p,
        pageSize,
      }),
    filterKey,
  )

  function refetchCurrentPage(): void {
    setPage((p) => p)
    onDataChanged()
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
    setSavingEditId(id)
    try {
      await updateOperation(id, {
        quantity: qty,
        operationType: editDraft.operationType,
        person: editDraft.person.trim(),
        destination: editDraft.destination.trim(),
      })
      cancelEdit()
      refetchCurrentPage()
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось изменить операцию.'))
    } finally {
      setSavingEditId(null)
    }
  }

  async function handleDelete(id: number): Promise<void> {
    setDeletingId(id)
    try {
      await deleteOperation(id)
      refetchCurrentPage()
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось удалить операцию.'))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleConfirmOperation(id: number): Promise<void> {
    setConfirmingId(id)
    try {
      await confirmOperationsIn1c([id])
      refetchCurrentPage()
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось подтвердить перенос операции в 1С.'))
    } finally {
      setConfirmingId(null)
    }
  }

  async function handleUnconfirmOperation(id: number): Promise<void> {
    setConfirmingId(id)
    try {
      await unconfirmOperationIn1c(id)
      refetchCurrentPage()
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось отменить подтверждение.'))
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <div className={panelClass} style={panelStyle}>
      <h3 className="mb-3 text-sm font-bold text-[var(--plasma-color)]">История операций</h3>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <label className={labelClass}>Номенклатура</label>
          <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Поиск…" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>С даты</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>По дату</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Тип</label>
          <select value={operationType} onChange={(e) => setOperationType(e.target.value as OperationType | '')} className={selectClass}>
            <option value="">Все</option>
            <option value="issue">Выдача</option>
            <option value="return">Возврат</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>ФИО</label>
          <input type="text" value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Поиск…" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Адрес/объект</label>
          <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Поиск…" className={fieldClass} />
        </div>
      </div>

      {items.length === 0 && !loading ? (
        <div className="px-2.5 py-4 text-center text-[13px] text-[#e8f8ff]/50">Операций не найдено.</div>
      ) : (
        <div className={mode === 'scroll' ? scrollBoxClass : undefined}>
        <table className="w-full min-w-[820px] border-collapse text-[13px] text-[#e8f8ff]/85">
          <thead>
            <tr>
              {['Дата', 'Номенклатура', 'Тип', 'Кол-во', 'ФИО', 'Адрес/место назначения', 'Кто ввёл', ...(canManageOps ? ['Экспорт', 'Подтверждено в 1С', 'Действия'] : [])].map(
                (h) => (
                  <th key={h} className="sticky top-0 z-10 bg-[#14172c] px-2.5 py-2 text-left font-bold text-[var(--plasma-color)]">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((op) => {
              const isEditing = editingId === op.id
              return (
                <tr key={op.id} className="hover:bg-white/4">
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2 whitespace-nowrap">{formatDate(op.createdAt)}</td>
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
                      <div className="w-24">
                        <input
                          type="number"
                          value={editDraft.quantity}
                          onChange={(e) => setEditDraft({ ...editDraft, quantity: e.target.value })}
                          className={`${fieldClass} py-1`}
                        />
                      </div>
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
                  {canManageOps && (
                    <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2 whitespace-nowrap text-[11px]">
                      {op.exportedAt ? formatDate(op.exportedAt) : <span className="text-[#e8f8ff]/40">—</span>}
                    </td>
                  )}
                  {canManageOps && (
                    <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2 whitespace-nowrap text-[11px]">
                      {op.confirmedIn1cAt ? formatDate(op.confirmedIn1cAt) : <span className="text-[#e8f8ff]/40">—</span>}
                    </td>
                  )}
                  {canManageOps && (
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
                          <button type="button" onClick={cancelEdit} className="rounded-md border border-[#e8f8ff]/20 px-2 py-1 text-[11px] text-[#e8f8ff]/70">
                            Отмена
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
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
                          {op.confirmedIn1cAt ? (
                            <button
                              type="button"
                              disabled={confirmingId === op.id}
                              onClick={() => void handleUnconfirmOperation(op.id)}
                              className="flex items-center gap-1.5 rounded-md border border-[#e8f8ff]/20 px-2.5 py-1 text-[11px] text-[#e8f8ff]/80 transition-colors hover:bg-white/6 disabled:opacity-50"
                            >
                              {confirmingId === op.id && <Spinner className="h-3 w-3" />}
                              Отменить подтверждение
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={confirmingId === op.id}
                              onClick={() => void handleConfirmOperation(op.id)}
                              className="flex items-center gap-1.5 rounded-md border border-emerald-400/35 px-2.5 py-1 text-[11px] text-emerald-300 transition-colors hover:bg-emerald-500/15 disabled:opacity-50"
                            >
                              {confirmingId === op.id && <Spinner className="h-3 w-3" />}
                              Подтвердить в 1С
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-[#e8f8ff]/70">
          <Spinner className="h-4 w-4" />
          Загрузка…
        </div>
      )}

      {total > 0 && <PaginationBar mode={mode} onModeChange={setMode} page={page} totalPages={totalPages} onPageChange={setPage} loading={loading} />}
    </div>
  )
}
