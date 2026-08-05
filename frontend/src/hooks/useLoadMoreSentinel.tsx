import { useEffect, useRef } from 'react'

/** Невидимый элемент-«часовой» внизу списка — как только он попадает во вьюпорт
 * (пользователь долистал почти до конца), вызывает onIntersect (подгрузка следующей
 * порции). rootMargin с запасом — подгрузка начинается чуть раньше, чем упрёшься в низ. */
export function useLoadMoreSentinel(onIntersect: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onIntersect()
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled, onIntersect])

  return ref
}
