import { getUser } from '@/lib/auth.tsx'

const DOCS: { title: string; roles: string[] }[] = [
  { title: 'Инженерная документация (схемы, чертежи)', roles: ['Инженер', 'Администратор'] },
  { title: 'Бухгалтерские отчёты (баланс, налоги)', roles: ['Бухгалтер', 'Администратор'] },
  { title: 'Политика безопасности', roles: ['Администратор'] },
  { title: 'Общие инструкции', roles: ['Инженер', 'Бухгалтер', 'Администратор'] },
  { title: 'Технические спецификации', roles: ['Инженер'] },
  { title: 'Финансовые планы', roles: ['Бухгалтер', 'Администратор'] },
]

/** React-порт settings/navigation/pages/private/docs.ts — статический список документов,
 * доступ по роли текущего пользователя. ВНИМАНИЕ: сравнение по имени роли (не по правам) —
 * временный мост до отдельной задачи на права для документов/финансов; если переименовать
 * роль «Инженер»/«Бухгалтер»/«Администратор» через новую админку, доступ тут молча собьётся. */
export function DocsPage() {
  const role = getUser()?.role.name ?? 'гость'
  const accessible = DOCS.filter((doc) => doc.roles.includes(role))

  return (
    <div>
      <h3 className="mb-3.5 text-[16px] font-bold text-[var(--plasma-color)] [text-shadow:0_0_6px_color-mix(in_srgb,var(--plasma-color)_50%,transparent)]">
        Документы, доступные для роли «{role}»
      </h3>
      {accessible.length === 0 ? (
        <p className="text-[var(--cab-text)]/85">Нет доступных документов для вашей роли.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {accessible.map((doc) => (
            <li
              key={doc.title}
              className="rounded-lg border-l-[3px] border-l-[var(--plasma-color)] px-4 py-3 text-[var(--cab-text)]/90"
              style={{ background: 'color-mix(in srgb, var(--plasma-color) 6%, var(--cab-panel-form))' }}
            >
              {doc.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
