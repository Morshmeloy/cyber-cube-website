import { useEffect, useState } from 'react'
import { fetchNomenclature, type Nomenclature } from '@/lib/warehouse-api.tsx'
import { usePaginatedList } from '@/hooks/usePaginatedList.tsx'
import { useLoadMoreSentinel } from '@/hooks/useLoadMoreSentinel.tsx'
import { PaginationBar } from './PaginationBar.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'
import { fieldClass, panelClass, panelStyle, secondaryButtonClass } from './shared.tsx'

interface NomenclatureTableProps {
  /** Меняется снаружи (после ручного «Обновить» или синка с 1С) — форсирует рефетч. */
  refreshToken: number
  syncStatusLabel: string
  onManualRefresh: () => void
  manualRefreshing: boolean
  canSync: boolean
  onSync: () => void
  syncing: boolean
}

export function NomenclatureTable({
  refreshToken,
  syncStatusLabel,
  onManualRefresh,
  manualRefreshing,
  canSync,
  onSync,
  syncing,
}: NomenclatureTableProps) {
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { mode, setMode, page, setPage, totalPages, items, total, loading, loadMore, hasMore } = usePaginatedList<Nomenclature>(
    (p, pageSize) => fetchNomenclature({ query, page: p, pageSize }),
    `${query}|${refreshToken}`,
  )

  const sentinelRef = useLoadMoreSentinel(loadMore, mode === 'scroll' && hasMore)

  return (
    <div className={panelClass} style={panelStyle}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[var(--plasma-color)]">Остатки по номенклатуре</h3>
          <p className="text-[11px] text-[#e8f8ff]/50">{syncStatusLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onManualRefresh} disabled={manualRefreshing} className={secondaryButtonClass}>
            {manualRefreshing && <Spinner className="h-3.5 w-3.5" />}
            Обновить
          </button>
          {canSync && (
            <button type="button" onClick={onSync} disabled={syncing} className={secondaryButtonClass}>
              {syncing && <Spinner className="h-3.5 w-3.5" />}
              Обновить данные из 1С
            </button>
          )}
        </div>
      </div>

      <input
        type="text"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Поиск по названию или коду…"
        className={`${fieldClass} mb-3`}
      />

      {items.length === 0 && !loading ? (
        <div className="px-2.5 py-4 text-center text-[13px] text-[#e8f8ff]/50">
          {total === 0 && !query ? 'Номенклатуры пока нет — нажми «Обновить данные из 1С».' : 'Ничего не найдено.'}
        </div>
      ) : (
        <table className="w-full min-w-[680px] border-collapse text-[13px] text-[#e8f8ff]/85">
          <thead>
            <tr>
              {['Код', 'Номенклатура', 'Ед.', 'Остаток из 1С', 'Движение через портал', 'Итоговый остаток'].map((h) => (
                <th key={h} className="bg-white/6 px-2.5 py-2 text-left font-bold text-[var(--plasma-color)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-white/4">
                <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2 text-[#e8f8ff]/60 whitespace-nowrap">{item.code ?? '—'}</td>
                <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{item.name}</td>
                <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2 text-[#e8f8ff]/60">{item.unit ?? '—'}</td>
                <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{item.baseQuantity}</td>
                <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{item.portalQuantity > 0 ? `+${item.portalQuantity}` : item.portalQuantity}</td>
                <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2 font-bold">{item.totalQuantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {loading && items.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-[#e8f8ff]/70">
          <Spinner className="h-4 w-4" />
          Загрузка…
        </div>
      )}

      {total > 0 && <PaginationBar mode={mode} onModeChange={setMode} page={page} totalPages={totalPages} onPageChange={setPage} loading={loading} />}
      {mode === 'scroll' && hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
    </div>
  )
}
