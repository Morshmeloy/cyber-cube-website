import { useEffect, useState } from 'react'

export type CabinetTheme = 'dark' | 'light'

const STORAGE_KEY = 'd4_cabinet_theme'

function readStoredTheme(): CabinetTheme {
  return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
}

/** Тема личного кабинета (Dashboard/Warehouse/Docs/Finance/Admin) — только эта область
 * сайта имеет светлый вариант, запоминается в localStorage между заходами. */
export function useCabinetTheme(): { theme: CabinetTheme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<CabinetTheme>(readStoredTheme)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  function toggleTheme(): void {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return { theme, toggleTheme }
}
