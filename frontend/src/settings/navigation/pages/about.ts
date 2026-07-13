import type { PageContent } from '../../../types/page-content.ts'

/** Грань «О нас» — сертификаты и партнёрский статус, источник: главная страница «Комплексная автоматизация». */
export const aboutPageContent: PageContent = {
  title: 'О нас',
  blocks: [
    {
      kind: 'paragraph',
      text: '«Д4 технологии» — сертифицированный партнёр ведущих российских и международных вендоров в области сетевой инфраструктуры, информационной безопасности и импортозамещённого программного обеспечения.',
    },
    {
      kind: 'list',
      items: [
        'РусБИТех-Астра — партнёрский статус',
        'ИВК RSAP — сертификат партнёра',
        'Базальт СПО — сертификат соответствия',
        'DEPO Certified Partner',
        'Kaspersky B2C Partner',
        'MaxPatrol EDR / MaxPatrol VM — партнёрский статус Positive Technologies',
        'PT Multiscanner / PT Sandbox — партнёрский статус Positive Technologies',
      ],
    },
    {
      kind: 'imageGallery',
      images: [
        { src: '/images/about/cert-rusbitech-4.jpg', alt: 'РусБИТех-Астра 4' },
        { src: '/images/about/cert-ivk-rsap.jpg', alt: 'ИВК RSAP' },
        { src: '/images/about/cert-bazalt-spo.jpg', alt: 'Базальт СПО' },
        { src: '/images/about/cert-depo.jpg', alt: 'DEPO Certified Partner' },
        { src: '/images/about/cert-partners.jpg', alt: 'Сертификат партнерства' },
        { src: '/images/about/cert-d4nms-registration.jpg', alt: 'Свидетельство о регистрации ПО D4NMS' },
        { src: '/images/about/cert-generic.jpg', alt: 'Сертификат' },
        { src: '/images/about/cert-kaspersky.jpg', alt: 'Kaspersky B2C Partner' },
        { src: '/images/about/cert-maxpatrol-edr.jpg', alt: 'MaxPatrol EDR' },
        { src: '/images/about/cert-maxpatrol-vm.jpg', alt: 'MaxPatrol VM' },
        { src: '/images/about/cert-pt-multiscanner.jpg', alt: 'PT Multiscanner' },
        { src: '/images/about/cert-pt-sandbox.jpg', alt: 'PT Sandbox' },
        { src: '/images/about/cert-rusbitech-1.jpg', alt: 'РусБИТех-Астра' },
        { src: '/images/about/cert-rusbitech-2.jpg', alt: 'РусБИТех-Астра 2' },
        { src: '/images/about/cert-rusbitech-3.jpg', alt: 'РусБИТех-Астра 3' },
      ],
    },
    {
      kind: 'paragraph',
      text: 'Собственное программное обеспечение D4 NMS официально включено в Единый реестр российских программ для ЭВМ и баз данных Минцифры России, что подтверждает статус компании как разработчика и правообладателя импортонезависимых технологий.',
    },
  ],
}
