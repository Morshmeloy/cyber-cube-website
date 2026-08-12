import { useEffect, useState } from 'react'
import { fetchNomenclature, type Nomenclature } from '@/lib/warehouse-api.tsx'
import { usePaginatedList } from '@/hooks/usePaginatedList.tsx'
import { PaginationBar } from './PaginationBar.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'
import { fieldClass, panelClass, panelStyle, scrollBoxClass, secondaryButtonClass } from './shared.tsx'

const HIGHLIGHT_STORAGE_KEY = 'd4_nomenclature_highlighted'

/** Отметки строк — только id, без данных самих позиций (см. обсуждение): работают
 * только в режиме "Листать вниз", где весь список и так загружен одним запросом. */
function readStoredHighlights(): Set<number> {
  try {
    const raw = localStorage.getItem(HIGHLIGHT_STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

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
  const [highlightedIds, setHighlightedIds] = useState<Set<number>>(readStoredHighlights)
  const [onlyHighlighted, setOnlyHighlighted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { mode, setMode, page, setPage, totalPages, items, total, loading } = usePaginatedList<Nomenclature>(
    (p, pageSize) => fetchNomenclature({ query, page: p, pageSize }),
    `${query}|${refreshToken}`,
  )

  useEffect(() => {
    localStorage.setItem(HIGHLIGHT_STORAGE_KEY, JSON.stringify([...highlightedIds]))
  }, [highlightedIds])

  // Отметки — только фишка режима "Листать вниз" (там весь список уже загружен разом).
  // При выходе из этого режима сам набор отметок не теряется (лежит в localStorage),
  // просто фильтр/кнопки скрываются, пока не вернёшься в scroll.
  useEffect(() => {
    if (mode !== 'scroll') setOnlyHighlighted(false)
  }, [mode])

  function toggleHighlight(id: number): void {
    setHighlightedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearHighlights(): void {
    setHighlightedIds(new Set())
  }

  const displayedItems = mode === 'scroll' && onlyHighlighted ? items.filter((item) => highlightedIds.has(item.id)) : items

  return (
    <div className={panelClass} style={panelStyle}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[var(--plasma-color)]">Остатки по номенклатуре</h3>
          <p className="text-[12px] text-[var(--cab-text)]/50">{syncStatusLabel}</p>
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

      {mode === 'scroll' && (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[13px] text-[var(--cab-text)]/70">
          <label className="flex cursor-pointer items-center gap-1.5 select-none">
            <input type="checkbox" checked={onlyHighlighted} onChange={(e) => setOnlyHighlighted(e.target.checked)} />
            Показывать только отмеченные
          </label>
          {highlightedIds.size > 0 && (
            <>
              <span>
                Отмечено: <strong className="text-[var(--plasma-color)]">{highlightedIds.size}</strong>
              </span>
              <button type="button" onClick={clearHighlights} className="text-[12px] text-[var(--cab-text)]/50 underline hover:text-[var(--cab-text)]/80">
                Снять все отметки
              </button>
            </>
          )}
        </div>
      )}

      {displayedItems.length === 0 && !loading ? (
        <div className="px-2.5 py-4 text-center text-[14px] text-[var(--cab-text)]/50">
          {onlyHighlighted
            ? 'Нет отмеченных позиций.'
            : total === 0 && !query
              ? 'Номенклатуры пока нет — нажми «Обновить данные из 1С».'
              : 'Ничего не найдено.'}
        </div>
      ) : (
        <div className={mode === 'scroll' ? scrollBoxClass : undefined}>
          <table className="w-full min-w-[680px] border-collapse text-[16px] text-[var(--cab-text)]/85">
            <thead>
              <tr>
                {['Код', 'Номенклатура', 'Ед.', 'Остаток из 1С', 'Движение через портал', 'Итоговый остаток'].map((h) => (
                  <th key={h} className="sticky top-0 z-10 bg-[var(--cab-panel)] px-2.5 py-2 text-left font-bold text-[var(--plasma-color)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((item) => (
                <tr
                  key={item.id}
                  onDoubleClick={() => mode === 'scroll' && toggleHighlight(item.id)}
                  className={`${mode === 'scroll' ? 'cursor-pointer select-none' : ''} ${
                    // Хайлайт не смешиваем с ховером — иначе наведение мышью гасит отметку
                    // на строке, будто её сняли. У отмеченных строк своя заливка без hover-класса.
                    highlightedIds.has(item.id) ? 'bg-[var(--plasma-color)]/12' : 'hover:bg-white/4'
                  }`}
                >
                  <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2 text-[var(--cab-text)]/60 whitespace-nowrap">{item.code ?? '—'}</td>
                  <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">{item.name}</td>
                  <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2 text-[var(--cab-text)]/60">{item.unit ?? '—'}</td>
                  <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">{item.baseQuantity}</td>
                  <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2">{item.portalQuantity > 0 ? `+${item.portalQuantity}` : item.portalQuantity}</td>
                  <td className="border-b border-[var(--cab-text)]/8 px-2.5 py-2 font-bold">{item.totalQuantity}</td>
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
    </div>
  )
}
