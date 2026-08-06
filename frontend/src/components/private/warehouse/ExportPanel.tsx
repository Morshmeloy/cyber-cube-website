import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { confirmAllExportedIn1c, exportSelectedOperations, fetchOperations, type OperationType, type StockOperation } from '@/lib/warehouse-api.tsx'
import { usePaginatedList } from '@/hooks/usePaginatedList.tsx'
import { PaginationBar } from './PaginationBar.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'
import { fieldClass, formatDate, labelClass, panelClass, panelStyle, extractErrorMessage, scrollBoxClass, selectClass } from './shared.tsx'

function operationLabel(type: OperationType): string {
  return type === 'issue' ? '📤 Выдача' : '📥 Возврат'
}

interface ExportPanelProps {
  refreshToken: number
}

export function ExportPanel({ refreshToken: externalRefreshToken }: ExportPanelProps) {
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [operationType, setOperationType] = useState<OperationType | ''>('')
  const [person, setPerson] = useState('')
  const [destination, setDestination] = useState('')
  const [exportStatus, setExportStatus] = useState<'exported' | 'not_exported' | ''>('not_exported')

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [confirmingAll, setConfirmingAll] = useState(false)
  const [localRefreshToken, setLocalRefreshToken] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const filterKey = `${query}|${dateFrom}|${dateTo}|${operationType}|${person}|${destination}|${exportStatus}|${externalRefreshToken}|${localRefreshToken}`

  const { mode, setMode, page, setPage, totalPages, items, total, loading } = usePaginatedList<StockOperation>(
    (p, pageSize) =>
      fetchOperations({
        query,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        operationType: operationType || undefined,
        person: person || undefined,
        destination: destination || undefined,
        exportStatus: exportStatus || undefined,
        page: p,
        pageSize,
      }),
    filterKey,
  )

  function toggleSelected(op: StockOperation): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(op.id)) next.delete(op.id)
      else next.add(op.id)
      return next
    })
  }

  function clearSelection(): void {
    setSelectedIds(new Set())
  }

  async function handleConfirmAllExported(): Promise<void> {
    setConfirmingAll(true)
    try {
      const result = await confirmAllExportedIn1c()
      toast.success(`Подтверждён перенос ${result.count} операций.`)
      setLocalRefreshToken((t) => t + 1)
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось подтвердить перенос операций.'))
    } finally {
      setConfirmingAll(false)
    }
  }

  async function handleGenerate(): Promise<void> {
    if (selectedIds.size === 0) return
    setGenerating(true)
    try {
      await exportSelectedOperations([...selectedIds])
      toast.success(`Документ сформирован — позиций: ${selectedIds.size}.`)
      clearSelection()
      setLocalRefreshToken((t) => t + 1)
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось сформировать документ.'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className={panelClass} style={panelStyle}>
      <h3 className="mb-3 text-sm font-bold text-[var(--plasma-color)]">Экспорт — Требование-накладная</h3>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
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
        <div>
          <label className={labelClass}>Статус экспорта</label>
          <select value={exportStatus} onChange={(e) => setExportStatus(e.target.value as 'exported' | 'not_exported' | '')} className={selectClass}>
            <option value="not_exported">Не экспортировано</option>
            <option value="exported">Уже экспортировано</option>
            <option value="">Всё</option>
          </select>
        </div>
      </div>

      {items.length === 0 && !loading ? (
        <div className="px-2.5 py-4 text-center text-[13px] text-[#e8f8ff]/50">Ничего не найдено по этим фильтрам.</div>
      ) : (
        <div className={mode === 'scroll' ? scrollBoxClass : undefined}>
          <table className="w-full min-w-[720px] border-collapse text-[13px] text-[#e8f8ff]/85">
            <thead>
              <tr>
                {['', 'Дата', 'Номенклатура', 'Тип', 'Кол-во', 'ФИО', 'Адрес/объект'].map((h) => (
                  <th key={h} className="sticky top-0 z-10 bg-[#14172c] px-2.5 py-2 text-left font-bold text-[var(--plasma-color)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((op) => (
                <tr key={op.id} className="cursor-pointer hover:bg-white/4" onClick={() => toggleSelected(op)}>
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">
                    <input type="checkbox" checked={selectedIds.has(op.id)} onChange={() => toggleSelected(op)} onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2 whitespace-nowrap">{formatDate(op.createdAt)}</td>
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{op.nomenclatureName}</td>
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{operationLabel(op.operationType)}</td>
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{op.quantity}</td>
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{op.person}</td>
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{op.destination}</td>
                </tr>
              ))}
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

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#e8f8ff]/10 pt-3.5">
        <span className="text-[13px] text-[#e8f8ff]/70">
          Выбрано позиций: <strong className="text-[var(--plasma-color)]">{selectedIds.size}</strong>
        </span>
        {selectedIds.size > 0 && (
          <button type="button" onClick={clearSelection} className="text-[12px] text-[#e8f8ff]/50 underline hover:text-[#e8f8ff]/80">
            Сбросить выбор
          </button>
        )}
        <button
          type="button"
          disabled={confirmingAll}
          onClick={() => void handleConfirmAllExported()}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-[#e8f8ff]/20 px-2.5 py-1.5 text-[12px] text-[#e8f8ff]/80 transition-colors hover:bg-white/6 disabled:opacity-50"
        >
          {confirmingAll && <Spinner className="h-3.5 w-3.5" />}
          Подтвердить перенос всех выгруженных
        </button>
        <button
          type="button"
          disabled={selectedIds.size === 0 || generating}
          onClick={() => void handleGenerate()}
          className="flex items-center gap-2 rounded-lg border border-[var(--plasma-color)] bg-[var(--plasma-color)] px-5 py-2.5 text-[13px] font-bold text-[#050510] disabled:opacity-50"
        >
          {generating && <Spinner className="h-4 w-4" />}
          Сформировать документ
        </button>
      </div>
    </div>
  )
}
