import { useEffect, useState } from 'react'
import type { Page } from '@/lib/warehouse-api.tsx'

export type PageMode = 'pages' | 'scroll'

/**
 * Общая пагинация для таблиц склада — два режима: «Постранично» (кнопки ◀▶, полная
 * замена видимого набора) и «Листать вниз» (подгрузка по pageSize при приближении к
 * низу списка, накопительно, как обычная прокрутка). watchKey должен меняться при
 * смене фильтров/поиска — тогда список сбрасывается на первую страницу.
 */
export function usePaginatedList<T>(
  fetchPage: (page: number, pageSize: number) => Promise<Page<T>>,
  watchKey: string,
  pageSize = 10,
) {
  const [mode, setModeState] = useState<PageMode>('pages')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  function setMode(next: PageMode): void {
    setModeState(next)
    setItems([])
  }

  useEffect(() => {
    setPage(1)
    setItems([])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- watchKey — единственный сигнал сброса, mode обрабатывается setMode
  }, [watchKey])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchPage(page, pageSize)
      .then((result) => {
        if (cancelled) return
        setTotal(result.total)
        setItems((prev) => (mode === 'scroll' && page > 1 ? [...prev, ...result.items] : result.items))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchPage замыкает фильтры, отслеживаемые через watchKey
  }, [page, watchKey, mode])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasMore = items.length < total

  function loadMore(): void {
    if (!loading && hasMore) setPage((p) => p + 1)
  }

  return { mode, setMode, page, setPage, totalPages, items, total, loading, hasMore, loadMore }
}
