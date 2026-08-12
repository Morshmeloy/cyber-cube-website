import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { PageBlock, PageContent, PageLinkTarget, PageNavigationTarget } from '@/types/page-content.tsx'
import { CertificateCarousel } from './CertificateCarousel.tsx'

interface PageRendererProps {
  content: PageContent
  navigateTo: (target: PageNavigationTarget) => void
}

const GLOW_BORDER = 'border-[color-mix(in_srgb,var(--plasma-color)_40%,transparent)]'
const GLOW_TEXT = 'text-[var(--plasma-color)] [text-shadow:0_0_6px_color-mix(in_srgb,var(--plasma-color)_50%,transparent)]'

/** Кликабельный элемент для PageLinkTarget: реальная <a target="_blank"> для внешних/файловых
 * ссылок, иначе <button> на переход внутри панели. */
function LinkTrigger({ target, label, className, navigateTo }: { target: PageLinkTarget; label: string; className: string; navigateTo: (t: PageNavigationTarget) => void }) {
  if ('href' in target) {
    return (
      <a href={target.href} target="_blank" rel="noopener" className={className}>
        {label}
      </a>
    )
  }
  return (
    <button type="button" className={className} onClick={() => navigateTo(target)}>
      {label}
    </button>
  )
}

/** Мост к HTMLElement, который возвращает custom-блок (личный кабинет пока не переведён
 * на React — см. следующие этапы) — монтируем как есть через ref, без переписывания. */
function CustomBlockBridge({ render, navigateTo }: { render: (ctx: { navigateTo: (t: PageNavigationTarget) => void }) => HTMLElement; navigateTo: (t: PageNavigationTarget) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = render({ navigateTo })
    containerRef.current?.appendChild(el)
    return () => {
      el.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- render/navigateTo стабильны для времени жизни блока
  }, [])
  return <div ref={containerRef} className="opacity-0 animate-[plasmaBlockAppear_0.5s_ease_forwards]" />
}

function renderBlock(block: PageBlock, navigateTo: (target: PageNavigationTarget) => void, key: number): ReactNode {
  const appear = 'opacity-0 [animation:plasmaBlockAppear_0.5s_ease_forwards]'
  const style = { animationDelay: `${(key + 1) * 70}ms` }

  switch (block.kind) {
    case 'heading': {
      const Tag = block.level === 2 ? 'h2' : 'h3'
      const size = block.level === 2 ? 'text-[clamp(18px,2.4vw,24px)]' : 'text-[clamp(16px,2vw,20px)]'
      return (
        <Tag key={key} style={style} className={`${appear} ${size} mt-7 mb-3 font-bold tracking-wide ${GLOW_TEXT}`}>
          {block.text}
        </Tag>
      )
    }
    case 'paragraph':
      return (
        <p key={key} style={style} className={`${appear} mb-3.5 max-w-[860px] text-[clamp(14px,1.6vw,17px)] leading-[1.7] text-[#e8f8ff]/90`}>
          {block.text}
        </p>
      )
    case 'paragraphLink': {
      const linkClassName = 'cursor-pointer font-semibold text-[var(--plasma-color)] underline [text-shadow:0_0_6px_color-mix(in_srgb,var(--plasma-color)_50%,transparent)] hover:text-white'
      const target = block.target
      return (
        <p key={key} style={style} className={`${appear} mb-3.5 max-w-[860px] text-[clamp(14px,1.6vw,17px)] leading-[1.7] text-[#e8f8ff]/90`}>
          {block.before}
          {'href' in target ? (
            <a href={target.href} target="_blank" rel="noopener" className={linkClassName}>
              {block.linkText}
            </a>
          ) : (
            <button type="button" onClick={() => navigateTo(target)} className={linkClassName}>
              {block.linkText}
            </button>
          )}
          {block.after}
        </p>
      )
    }
    case 'paragraphEmphasis':
      return (
        <p key={key} style={style} className={`${appear} mb-3.5 max-w-[860px] text-[clamp(14px,1.6vw,17px)] leading-[1.7] text-[#e8f8ff]/90`}>
          {block.before}
          <strong className="text-[var(--secondary)] font-bold [text-shadow:0_0_6px_color-mix(in_srgb,var(--secondary)_50%,transparent)]">{block.emphasisText}</strong>
          {block.after}
        </p>
      )
    case 'list':
      return (
        <ul key={key} style={style} className={`${appear} mb-3.5 flex max-w-[860px] flex-col gap-2.5`}>
          {block.items.map((item, i) => (
            <li key={i} className="relative pl-5.5 text-[clamp(14px,1.5vw,16px)] leading-[1.6] text-[#e8f8ff]/85">
              <span className={`absolute left-0 ${GLOW_TEXT}`}>▸</span>
              {item}
            </li>
          ))}
        </ul>
      )
    case 'cardGrid':
      return (
        <div key={key} style={style} className={`${appear} mb-4.5 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5`}>
          {block.cards.map((card, i) => (
            <div
              key={i}
              className={`rounded-[10px] border ${GLOW_BORDER} border-l-[3px] border-l-[var(--secondary)] bg-[color-mix(in_srgb,var(--secondary)_6%,rgba(0,0,0,0.25))] p-3.5 shadow-[0_0_16px_color-mix(in_srgb,var(--plasma-color)_25%,transparent),inset_0_0_20px_rgba(0,0,0,0.3)]`}
            >
              <h4 className={`mb-1.5 text-sm font-bold ${GLOW_TEXT}`}>{card.title}</h4>
              {card.text && <p className="text-[13px] leading-[1.55] text-[#e8f8ff]/85">{card.text}</p>}
              {card.items && card.items.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {card.items.map((item, j) => (
                    <li key={j} className="relative pl-4 text-[13px] leading-[1.55] text-[#e8f8ff]/85">
                      <span className="absolute left-0 text-[var(--plasma-color)]">▸</span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              {card.tags && card.tags.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {card.tags.map((tag, j) => (
                    <span
                      key={j}
                      className="rounded-full border border-[color-mix(in_srgb,var(--plasma-color)_35%,transparent)] bg-[color-mix(in_srgb,var(--plasma-color)_12%,transparent)] px-2.5 py-0.5 text-[11px] text-[#e8f8ff]/75"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )
    case 'imageGallery':
      return (
        <div key={key} style={style} className={appear}>
          <CertificateCarousel images={block.images} />
        </div>
      )
    case 'contactInfo':
      return (
        <div key={key} style={style} className={`${appear} mb-3.5 rounded-[10px] border border-dashed ${GLOW_BORDER} p-3.5`}>
          {block.lines.map((line, i) => (
            <p key={i} className={`text-[clamp(13px,1.5vw,15px)] leading-[1.6] text-[#e8f8ff]/90 ${i > 0 ? 'mt-1.5' : ''}`}>
              {line}
            </p>
          ))}
        </div>
      )
    case 'linkButtons':
      return (
        <div key={key} style={style} className={`${appear} my-2 mb-4.5 flex flex-wrap gap-3.5`}>
          {block.buttons.map((btn, i) => (
            <LinkTrigger
              key={i}
              target={btn.target}
              label={btn.label}
              navigateTo={navigateTo}
              className={
                i === 0
                  ? 'inline-block rounded-lg border border-[var(--plasma-color)] bg-[var(--plasma-color)] px-5.5 py-2.5 text-sm font-semibold text-[#050510] shadow-[0_0_16px_color-mix(in_srgb,var(--plasma-color)_45%,transparent)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_24px_color-mix(in_srgb,var(--plasma-color)_65%,transparent)]'
                  : 'inline-block rounded-lg border border-[var(--plasma-color)] px-5.5 py-2.5 text-sm font-semibold text-[var(--plasma-color)] transition-all hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--plasma-color)_15%,transparent)]'
              }
            />
          ))}
        </div>
      )
    case 'contactForm':
      return (
        <ContactFormBlock key={key} style={style} appear={appear} heading={block.heading} recipientEmail={block.recipientEmail} />
      )
    case 'map':
      return (
        <div key={key} style={style} className={`${appear} relative aspect-video w-full max-w-[640px] overflow-hidden rounded-[10px] border ${GLOW_BORDER} shadow-[0_0_14px_color-mix(in_srgb,var(--plasma-color)_20%,transparent)]`}>
          <iframe src={block.embedUrl} title={block.title} loading="lazy" allowFullScreen className="absolute inset-0 h-full w-full border-0" />
        </div>
      )
    case 'custom':
      return (
        <div key={key} style={style} className={appear}>
          <CustomBlockBridge render={block.render} navigateTo={navigateTo} />
        </div>
      )
    case 'component':
      return (
        <div key={key} style={style} className={appear}>
          {block.render({ navigateTo })}
        </div>
      )
  }
}

/** Форма обратной связи — mailto: (нет бэкенда для тихой отправки, открывает почтовый
 * клиент пользователя с заполненным письмом). Поля — uncontrolled (просто читаются по
 * submit), контролируемое состояние тут не нужно. */
function ContactFormBlock({ heading, recipientEmail, style, appear }: { heading: string; recipientEmail: string; style: React.CSSProperties; appear: string }) {
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const subjectRef = useRef<HTMLInputElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)

  const fieldClass = `rounded-lg border border-[#e8f8ff]/25 bg-[#05051099] px-3 py-2.5 font-inherit text-sm text-[#e8f8ff] transition-[border-color,box-shadow] placeholder:text-[#e8f8ff]/35 focus:border-[var(--plasma-color)] focus:shadow-[0_0_12px_color-mix(in_srgb,var(--plasma-color)_35%,transparent)] focus:outline-none`

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    if (!form.reportValidity()) return

    const name = nameRef.current!.value.trim()
    const email = emailRef.current!.value.trim()
    const subject = subjectRef.current!.value.trim() || 'Сообщение с сайта'
    const message = messageRef.current!.value.trim()
    const body = `Имя: ${name}\nEmail: ${email}\n\n${message}`
    window.location.href = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

    if (statusRef.current) {
      statusRef.current.textContent = `Открываем ваш почтовый клиент с готовым письмом. Если он не открылся, напишите нам напрямую на ${recipientEmail}.`
    }
  }

  return (
    <div style={style} className={`${appear} max-w-[520px] rounded-xl border ${GLOW_BORDER} bg-black/22 p-5`}>
      <div className={`mb-4 text-[15px] font-bold ${GLOW_TEXT}`}>{heading}</div>
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cf-name" className="text-[13px] text-[#e8f8ff]/70">
            Ваше имя
          </label>
          <input ref={nameRef} id="cf-name" type="text" placeholder="Иван Иванов" required className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cf-email" className="text-[13px] text-[#e8f8ff]/70">
            Ваш Email
          </label>
          <input ref={emailRef} id="cf-email" type="email" placeholder="ivan@example.com" required className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cf-subject" className="text-[13px] text-[#e8f8ff]/70">
            Тема
          </label>
          <input ref={subjectRef} id="cf-subject" type="text" placeholder="Тема вашего сообщения" className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cf-message" className="text-[13px] text-[#e8f8ff]/70">
            Сообщение
          </label>
          <textarea ref={messageRef} id="cf-message" rows={5} placeholder="Введите ваше сообщение здесь..." required className={`${fieldClass} min-h-[100px] resize-y`} />
        </div>
        <button
          type="submit"
          className="inline-block w-fit rounded-lg border border-[var(--plasma-color)] bg-[var(--plasma-color)] px-5.5 py-2.5 text-sm font-semibold text-[#050510] shadow-[0_0_16px_color-mix(in_srgb,var(--plasma-color)_45%,transparent)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_24px_color-mix(in_srgb,var(--plasma-color)_65%,transparent)]"
        >
          Отправить
        </button>
      </form>
      <p ref={statusRef} className="mt-3 max-w-[520px] text-[13px] leading-[1.6] text-[#e8f8ff]/70" />
    </div>
  )
}

/** React-порт plasma.ts::renderContent — обходит PageContent.blocks и строит JSX вместо
 * createElement-цепочек. Стили — Tailwind (в основном произвольные значения, потому что
 * акцентный цвет страницы динамический — --plasma-color, читается через var()). */
export function PageRenderer({ content, navigateTo }: PageRendererProps) {
  return (
    <div className="mx-auto block max-w-[1180px] font-heading text-[var(--cab-text,#e8f8ff)]">
      {content.title && (
        <h1 className="mb-6 text-[clamp(22px,3.6vw,34px)] leading-[1.3] font-black tracking-wide text-[var(--plasma-color)] [text-shadow:0_0_8px_color-mix(in_srgb,var(--plasma-color)_60%,transparent),0_0_20px_color-mix(in_srgb,var(--plasma-color)_30%,transparent)]">
          {content.title}
        </h1>
      )}
      {content.blocks.map((block, i) => renderBlock(block, navigateTo, i))}
    </div>
  )
}
