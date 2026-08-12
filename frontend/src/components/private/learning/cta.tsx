/** Тот же стиль кнопок, что и в PageRenderer.tsx (linkButtons/contactForm) — по цвету
 * текущей страницы (--plasma-color), инлайновая копия вместо общего компонента: кнопки
 * здесь — обычные <button>, а не переходы по PageLinkTarget, так что переиспользовать
 * компонент LinkTrigger нет смысла, но className должен визуально совпадать. */
export const CTA_PRIMARY =
  'inline-block rounded-lg border border-[var(--plasma-color)] bg-[var(--plasma-color)] px-5.5 py-2.5 text-sm font-semibold text-[var(--cab-bg)] shadow-[0_0_16px_color-mix(in_srgb,var(--plasma-color)_45%,transparent)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_24px_color-mix(in_srgb,var(--plasma-color)_65%,transparent)] disabled:pointer-events-none disabled:opacity-40'

export const CTA_OUTLINE =
  'inline-block rounded-lg border border-[var(--plasma-color)] px-5.5 py-2.5 text-sm font-semibold text-[var(--plasma-color)] transition-all hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--plasma-color)_15%,transparent)] disabled:pointer-events-none disabled:opacity-40'
