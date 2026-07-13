import type { FooterNavItem } from '../../types/navigation.ts'

/** Контент общего футера сайта — источник: подвал страниц основного сайта d4tech.ru. */
export const FOOTER_TAGLINE = 'Комплексная автоматизация и цифровизация объектов электроэнергетики'

export const FOOTER_NAV_ITEMS: FooterNavItem[] = [
  { label: 'О нас', face: 'back' },
  { label: 'Решения и услуги', face: 'right' },
  { label: 'Программное обеспечение', face: 'left' },
  { label: 'Поддержка', face: 'top' },
  { label: 'Контакты', face: 'bottom' },
  { label: 'Авторизация', face: 'front' },
]

export const FOOTER_CONTACT_LINES: { label: string; value: string; href?: string }[] = [
  { label: 'E-mail', value: 'info@d4tech.ru', href: 'mailto:info@d4tech.ru' },
  { label: 'Тел', value: '+7 (910) 235-70-37', href: 'tel:+79102357037' },
  {
    label: 'Адрес',
    value: '109390 г. Москва, вн. тер. г. муниципальный округ Текстильщики, ул. Люблинская, д. 47, помещ. IX (этаж 1), комн. 1, офис 17-5',
  },
]

export const FOOTER_LEGAL_LINES: { text: string; href?: string; emphasis?: boolean; openLegalPage?: boolean }[] = [
  { text: 'Общество с ограниченной ответственностью «Д4 технологии»', emphasis: true },
  { text: 'ИНН: 9723116807 | ОГРН: 1217700245916 | КПП: 772301001' },
  { text: 'Правовая информация (Приказ Минцифры РФ № 511)', openLegalPage: true },
  { text: '© 2021–2026 Все права защищены.' },
]

export const FOOTER_CREDIT_LINE = 'Разработка сайта — Д4 Технологии'
