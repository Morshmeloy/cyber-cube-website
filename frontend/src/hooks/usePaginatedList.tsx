import { useEffect, useState } from 'react'
import type { Page } from '@/lib/warehouse-api.tsx'

export type PageMode = 'pages' | 'scroll'

/** «Листать вниз» — один запрос на весь список (без подгрузки по скроллу), дальше
 * чисто клиентская прокрутка внутри рамки фиксированной высоты (см. scrollBoxClass). */
const SCROLL_MODE_FETCH_SIZE = 1000

/**
 * Общая пагинация для таблиц склада — два режима: «Постранично» (кнопки ◀▶, запрос на
 * каждую страницу по pageSize) и «Листать вниз» (один запрос сразу на всё, до
 * SCROLL_MODE_FETCH_SIZE записей, дальше только прокрутка без новых запросов).
 * watchKey должен меняться при смене фильтров/поиска — тогда список перезапрашивается.
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
    setPage(1)
  }

  useEffect(() => {
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- watchKey — единственный сигнал сброса
  }, [watchKey])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const effectivePage = mode === 'scroll' ? 1 : page
    const effectiveSize = mode === 'scroll' ? SCROLL_MODE_FETCH_SIZE : pageSize
    fetchPage(effectivePage, effectiveSize)
      .then((result) => {
        if (cancelled) return
        setTotal(result.total)
        setItems(result.items)
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

  return { mode, setMode, page, setPage, totalPages, items, total, loading }
}
