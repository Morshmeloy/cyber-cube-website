import type { PageContent } from '../../../types/page-content.ts'

/** Грань «Авторизация» (лицевая грань с логотипом) — личный кабинет пока не реализован. */
export const authPageContent: PageContent = {
  title: 'Авторизация',
  blocks: [
    {
      kind: 'paragraph',
      text: 'Личный кабинет клиента находится в разработке и появится в одном из следующих обновлений сайта.',
    },
    {
      kind: 'contactInfo',
      lines: ['Если вам уже нужен доступ к своему аккаунту — напишите нам: info@d4tech.ru'],
    },
  ],
}
