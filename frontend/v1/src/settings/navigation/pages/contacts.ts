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
    { kind: 'contactForm', heading: 'Отправьте нам сообщение', recipientEmail: 'info@d4tech.ru' },
    { kind: 'heading', level: 2, text: 'Карта' },
    {
      kind: 'map',
      embedUrl: 'https://yandex.ru/map-widget/v1/?ll=37.617635%2C55.755826&z=16&l=map&pt=37.617635%2C55.755826%2Cpmblm',
      title: 'Карта расположения офиса',
    },
  ],
}
