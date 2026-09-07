import { ExternalLink, Mail, ShieldCheck, TimerReset, Wifi } from 'lucide-react'
import { MAIL_UI_URL } from '@/lib/mail.tsx'

const panelStyle = {
  background: 'color-mix(in srgb, var(--plasma-color) 6%, var(--cab-panel))',
  borderColor: 'color-mix(in srgb, var(--plasma-color) 18%, transparent)',
}

export function MailPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(240px,0.65fr)]">
      <section className="rounded-2xl border p-5 sm:p-6" style={panelStyle}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--cab-text)]/10 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--plasma-color)]/45 bg-[var(--plasma-color)]/12 text-[var(--plasma-color)] shadow-[0_0_18px_color-mix(in_srgb,var(--plasma-color)_25%,transparent)]">
              <Mail aria-hidden="true" className="h-6 w-6" />
            </div>
            <div>
              <p className="mb-1 text-xs font-bold tracking-[0.14em] text-[var(--plasma-color)] uppercase">Рабочий сервис</p>
              <h3 className="text-xl font-extrabold text-[var(--cab-text)]">Корпоративная почта</h3>
            </div>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/8 px-3 py-1.5 text-xs font-semibold text-emerald-200">
            <Wifi aria-hidden="true" className="h-3.5 w-3.5" />
            Доступна без VPN
          </span>
        </div>

        <div className="rounded-xl border border-[var(--cab-text)]/12 bg-[var(--cab-field-bg)]/55 p-4 sm:p-5">
          <h4 className="mb-2 text-sm font-bold text-[var(--plasma-color)]">Открытие через защищённый адрес d4tech.ru</h4>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--cab-text)]/72">
            Кнопка открывает штатную форму Mailcow в отдельной вкладке. После успешной проверки почтовых данных Mailcow переводит пользователя в SOGo. Сайт не
            получает и не хранит почтовый пароль.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href={MAIL_UI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--plasma-color)] bg-[var(--plasma-color)] px-4 py-2.5 text-sm font-bold text-[var(--cab-bg)] transition-[filter,box-shadow] hover:brightness-110 hover:shadow-[0_0_16px_color-mix(in_srgb,var(--plasma-color)_35%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--plasma-color)]"
            >
              Открыть почту в новой вкладке
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </a>
            <span className="text-xs text-[var(--cab-text)]/50">Публичный адрес: d4tech.ru/mail</span>
          </div>
        </div>
      </section>

      <aside className="rounded-2xl border p-5" style={panelStyle}>
        <h3 className="mb-4 text-sm font-bold text-[var(--plasma-color)]">Как устроен доступ</h3>

        <div className="space-y-4">
          <div className="flex gap-3">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--plasma-color)]" />
            <div>
              <div className="text-sm font-semibold text-[var(--cab-text)]">Проверка выполняется Mailcow</div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--cab-text)]/55">Учётные данные не проходят через API личного кабинета.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Wifi aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--plasma-color)]" />
            <div>
              <div className="text-sm font-semibold text-[var(--cab-text)]">Без корпоративного VPN</div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--cab-text)]/55">WEB1 передаёт запрос внутренней почтовой VM через reverse proxy.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <TimerReset aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--plasma-color)]" />
            <div>
              <div className="text-sm font-semibold text-[var(--cab-text)]">Повторный вход</div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--cab-text)]/55">
                Пока почтовая сессия действительна, повторно вводить пароль не требуется.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
