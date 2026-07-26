import { getUser } from '@/lib/auth.tsx'

const DOCS: { title: string; roles: string[] }[] = [
  { title: 'Инженерная документация (схемы, чертежи)', roles: ['engineer', 'admin'] },
  { title: 'Бухгалтерские отчёты (баланс, налоги)', roles: ['accountant', 'admin'] },
  { title: 'Политика безопасности', roles: ['admin'] },
  { title: 'Общие инструкции', roles: ['engineer', 'accountant', 'admin'] },
  { title: 'Технические спецификации', roles: ['engineer'] },
  { title: 'Финансовые планы', roles: ['accountant', 'admin'] },
]

/** React-порт settings/navigation/pages/private/docs.ts — статический список документов,
 * доступ по роли текущего пользователя. */
export function DocsPage() {
  const role = getUser()?.role ?? 'guest'
  const accessible = DOCS.filter((doc) => doc.roles.includes(role))

  return (
    <div>
      <h3 className="mb-3.5 text-[15px] font-bold text-[var(--plasma-color)] [text-shadow:0_0_6px_color-mix(in_srgb,var(--plasma-color)_50%,transparent)]">
        Документы, доступные для роли «{role}»
      </h3>
      {accessible.length === 0 ? (
        <p className="text-[#e8f8ff]/85">Нет доступных документов для вашей роли.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {accessible.map((doc) => (
            <li
              key={doc.title}
              className="rounded-lg border-l-[3px] border-l-[var(--plasma-color)] px-4 py-3 text-[#e8f8ff]/90"
              style={{ background: 'color-mix(in srgb, var(--plasma-color) 6%, #171b30)' }}
            >
              {doc.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
