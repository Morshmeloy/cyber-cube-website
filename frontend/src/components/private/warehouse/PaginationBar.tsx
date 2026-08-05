import type { PageMode } from '@/hooks/usePaginatedList.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'

interface PaginationBarProps {
  mode: PageMode
  onModeChange: (mode: PageMode) => void
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  loading: boolean
}

const buttonClass =
  'rounded-md border border-[#e8f8ff]/20 px-2.5 py-1 text-[12px] text-[#e8f8ff]/80 transition-colors hover:bg-white/6 disabled:opacity-40'
const activeButtonClass = 'border-[var(--plasma-color)] text-[var(--plasma-color)]'

export function PaginationBar({ mode, onModeChange, page, totalPages, onPageChange, loading }: PaginationBarProps) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#e8f8ff]/70">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onModeChange('pages')}
          className={`${buttonClass} ${mode === 'pages' ? activeButtonClass : ''}`}
        >
          Постранично
        </button>
        <button
          type="button"
          onClick={() => onModeChange('scroll')}
          className={`${buttonClass} ${mode === 'scroll' ? activeButtonClass : ''}`}
        >
          Листать вниз
        </button>
      </div>

      {mode === 'pages' && (
        <div className="flex items-center gap-1.5">
          <button type="button" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)} className={buttonClass}>
            ◀
          </button>
          <span>
            Стр. {page} из {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
            className={buttonClass}
          >
            ▶
          </button>
        </div>
      )}

      {mode === 'scroll' && loading && (
        <span className="flex items-center gap-1.5">
          <Spinner className="h-3 w-3" />
          Загрузка…
        </span>
      )}
    </div>
  )
}
