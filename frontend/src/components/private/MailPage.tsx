import { ExternalLink, Mail, ShieldCheck, WifiOff } from 'lucide-react'

const mailWebUrl = import.meta.env.VITE_MAIL_WEB_URL?.trim()

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
              <p className="mb-1 text-xs font-bold tracking-[0.14em] text-[var(--plasma-color)] uppercase">
                Внутренний сервис
              </p>
              <h3 className="text-xl font-extrabold text-[var(--cab-text)]">Корпоративная почта</h3>
            </div>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/8 px-3 py-1.5 text-xs font-semibold text-amber-200">
            <WifiOff aria-hidden="true" className="h-3.5 w-3.5" />
            Подключение готовится
          </span>
        </div>

        <div className="rounded-xl border border-[var(--cab-text)]/12 bg-[var(--cab-field-bg)]/55 p-4 sm:p-5">
          <h4 className="mb-2 text-sm font-bold text-[var(--plasma-color)]">Почтовый портал добавлен в личный кабинет</h4>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--cab-text)]/72">
            Интерфейс раздела уже подготовлен. Открытие почтового ящика станет доступно после восстановления внутренней почтовой VM и проверки её TLS-настроек.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {mailWebUrl ? (
              <a
                href={mailWebUrl}
                target="_blank"
                rel="noreferrer noopener"
                referrerPolicy="no-referrer"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--plasma-color)] bg-[var(--plasma-color)] px-4 py-2.5 text-sm font-bold text-[var(--cab-bg)] transition-[filter,box-shadow] hover:brightness-110 hover:shadow-[0_0_16px_color-mix(in_srgb,var(--plasma-color)_35%,transparent)]"
              >
                Открыть почту
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--cab-text)]/15 bg-[var(--cab-text)]/5 px-4 py-2.5 text-sm font-bold text-[var(--cab-text)]/40"
              >
                Почтовый сервер не подключён
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
            <span className="text-xs text-[var(--cab-text)]/50">Для доступа потребуется корпоративный VPN.</span>
          </div>
        </div>
      </section>

      <aside className="rounded-2xl border p-5" style={panelStyle}>
        <h3 className="mb-4 text-sm font-bold text-[var(--plasma-color)]">Безопасность подключения</h3>

        <div className="space-y-4">
          <div className="flex gap-3">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--plasma-color)]" />
            <div>
              <div className="text-sm font-semibold text-[var(--cab-text)]">Только для сотрудников</div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--cab-text)]/55">Раздел защищён авторизацией личного кабинета.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <WifiOff aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--plasma-color)]" />
            <div>
              <div className="text-sm font-semibold text-[var(--cab-text)]">VPN-соединение</div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--cab-text)]/55">Webmail останется во внутреннем контуре и не публикуется напрямую в интернет.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Mail aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--plasma-color)]" />
            <div>
              <div className="text-sm font-semibold text-[var(--cab-text)]">Следующий этап</div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--cab-text)]/55">После восстановления сервера подключим проверку доступности и безопасный вход.</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
