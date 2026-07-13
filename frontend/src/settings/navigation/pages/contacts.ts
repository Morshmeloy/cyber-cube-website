import type { PageContent } from '../../../types/page-content.ts'

/** Грань «Контакты» — источник: «Контакты — Д4 Технологии.html». */
export const contactsPageContent: PageContent = {
  title: 'Наши контакты',
  blocks: [
    {
      kind: 'contactInfo',
      lines: [
        'Email: info@d4tech.ru',
        'Телефон: +7 (910) 235-70-37',
        'Адрес: 109390 г. Москва, вн. тер. г. муниципальный округ Текстильщики, ул. Люблинская, д. 47, помещ. IX (этаж 1), комн. 1, офис 17-5',
      ],
    },
  ],
}
