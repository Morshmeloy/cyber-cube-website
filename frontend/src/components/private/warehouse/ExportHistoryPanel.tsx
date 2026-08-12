import { useState } from 'react'
import { toast } from 'sonner'
import {
  fetchExports,
  fetchExportDetail,
  downloadExport,
  deleteExport,
  type ExportListItem,
  type ExportDetail,
  type OperationType,
} from '@/lib/warehouse-api.tsx'
import { usePaginatedList } from '@/hooks/usePaginatedList.tsx'
import { PaginationBar } from './PaginationBar.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'
import { formatDate, panelClass, panelStyle, extractErrorMessage, scrollBoxClass, secondaryButtonClass } from './shared.tsx'

function operationLabel(type: OperationType): string {
  return type === 'issue' ? '📤 Выдача' : '📥 Возврат'
}

interface ExportHistoryPanelProps {
  refreshToken: number
}

export function ExportHistoryPanel({ refreshToken }: ExportHistoryPanelProps) {
  const [localRefreshToken, setLocalRefreshToken] = useState(0)
  const [selected, setSelected] = useState<ExportDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const filterKey = `${refreshToken}|${localRefreshToken}`

  const { mode, setMode, page, setPage, totalPages, items, total, loading } = usePaginatedList<ExportListItem>(
    (p, pageSize) => fetchExports(p, pageSize),
    filterKey,
  )

  async function openDetail(id: number): Promise<void> {
    setDetailLoading(true)
    try {
      setSelected(await fetchExportDetail(id))
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось загрузить экспорт.'))
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleDownload(id: number): Promise<void> {
    setDownloadingId(id)
    try {
      await downloadExport(id)
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось скачать документ.'))
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleDelete(id: number): Promise<void> {
    if (!window.confirm('Удалить эту запись из истории экспортов? Сами операции останутся в истории, действие необратимо.')) return
    setDeletingId(id)
    try {
      await deleteExport(id)
      toast.success('Экспорт удалён из истории.')
      setSelected(null)
      setLocalRefreshToken((t) => t + 1)
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось удалить экспорт.'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className={panelClass} style={panelStyle}>
      <h3 className="mb-3 text-sm font-bold text-[var(--plasma-color)]">История экспортов</h3>

      {detailLoading && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-[var(--cab-text)]/70">
          <Spinner className="h-4 w-4" />
          Загрузка…
        </div>
      )}

      {!detailLoading && selected && (
        <div className="rounded-lg border border-[var(--cab-text)]/15 bg-[var(--cab-field-bg)]/65 p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-[var(--plasma-color)]">
                {selected.invoiceNumber ? `Требование-накладная № ${selected.invoiceNumber}` : 'Требование-накладная'}
              </div>
              <div className="mt-1 text-[13px] text-[var(--cab-text)]/60">
                {formatDate(selected.createdAt)} · сформировал {selected.createdBy}
              </div>
            </div>
            <button type="button" onClick={() => setSelected(null)} className={secondaryButtonClass}>
              ← Назад к списку
            </button>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-[14px] text-[var(--cab-text)]/80 sm:grid-cols-2">
            <div>
              <span className="text-[var(--cab-text)]/50">Договор с заказчиком: </span>
              {selected.contractName || '—'}
            </div>
            <div>
              <span className="text-[var(--cab-text)]/50">Объект: </span>
              {selected.objectName || '—'}
            </div>
            <div>
              <span className="text-[var(--cab-text)]/50">Отпустил: </span>
              {selected.releasedBy || '—'}
            </div>
            <div>
              <span className="text-[var(--cab-text)]/50">Получил: </span>
              {selected.receivedBy || '—'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[16px] text-[var(--cab-text)]/85">
              <thead>
                <tr>
                  {['Номенклатура', 'Код', 'Тип', 'Кол-во', 'Ед.', 'ФИО', 'Адрес/объект'].map((h) => (
                    <th key={h} className="bg-white/6 px-2.5 py-2 text-left font-bold text-[var(--plasma-color)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected.items.map((item, i) => (
                  <tr key={i} className="hover:bg-white/4">
                    <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">{item.nomenclatureName}</td>
                    <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">{item.nomenclatureCode || '—'}</td>
                    <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">{operationLabel(item.operationType)}</td>
                    <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">{item.quantity}</td>
                    <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">{item.unit || '—'}</td>
                    <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">{item.person}</td>
                    <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">{item.destination}</td>
                  </tr>
                ))}
                {selected.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2.5 py-4 text-center text-[var(--cab-text)]/50">
                      Нет позиций (операции могли быть удалены).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end gap-2 border-t border-[var(--cab-text)]/10 pt-3.5">
            <button
              type="button"
              disabled={deletingId === selected.id}
              onClick={() => void handleDelete(selected.id)}
              className="flex items-center gap-1.5 rounded-md border border-red-400/35 px-3 py-2 text-[13px] text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-50"
            >
              {deletingId === selected.id && <Spinner className="h-3.5 w-3.5" />}
              Удалить
            </button>
            <button
              type="button"
              disabled={downloadingId === selected.id}
              onClick={() => void handleDownload(selected.id)}
              className="flex items-center gap-2 rounded-lg border border-[var(--plasma-color)] bg-[var(--plasma-color)] px-4 py-2 text-[13px] font-bold text-[var(--cab-bg)] disabled:opacity-50"
            >
              {downloadingId === selected.id && <Spinner className="h-3.5 w-3.5" />}
              Скачать
            </button>
          </div>
        </div>
      )}

      {!detailLoading && !selected && (
        <>
          {items.length === 0 && !loading ? (
            <div className="px-2.5 py-4 text-center text-[14px] text-[var(--cab-text)]/50">Пока нет ни одного экспорта.</div>
          ) : (
            <div className={mode === 'scroll' ? scrollBoxClass : undefined}>
              <table className="w-full min-w-[560px] border-collapse text-[16px] text-[var(--cab-text)]/85">
                <thead>
                  <tr>
                    {['Название', 'Дата', 'Автор', 'Позиций'].map((h) => (
                      <th key={h} className="sticky top-0 z-10 bg-[var(--cab-panel)] px-2.5 py-2 text-left font-bold text-[var(--plasma-color)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((exp) => (
                    <tr key={exp.id} className="cursor-pointer hover:bg-white/4" onClick={() => void openDetail(exp.id)}>
                      <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">{exp.title}</td>
                      <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2 whitespace-nowrap">{formatDate(exp.createdAt)}</td>
                      <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">{exp.createdBy}</td>
                      <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">{exp.itemsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loading && items.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-[var(--cab-text)]/70">
              <Spinner className="h-4 w-4" />
              Загрузка…
            </div>
          )}

          {total > 0 && <PaginationBar mode={mode} onModeChange={setMode} page={page} totalPages={totalPages} onPageChange={setPage} loading={loading} />}
        </>
      )}
    </div>
  )
}
