import type { PrivatePageKey } from '../../types/page-content.tsx'
import type { User } from '../../lib/auth.tsx'

/** Цвета страниц личного кабинета — приглушённая палитра, отдельная от неоновых цветов
 * граней куба (личный кабинет визуально — внутренний инструмент), но не тусклая: должна
 * читаться как рамка/свечение панели (--plasma-color) не хуже, чем у остальных страниц. */
export const PRIVATE_PAGE_COLORS: Record<PrivatePageKey, string> = {
  dashboard: '#5b7fff',
  learning: '#4a7c59',
  warehouse: '#b88a44',
  docs: '#3b6e8f',
  finance: '#8f4b6e',
}

/** Человекочитаемая подпись роли — для дашборда и виджета профиля. Роли — ровно
 * те, что знает бэкенд (backend/src/models/user.py::UserRole): admin/engineer/accountant. */
export const ROLE_LABELS: Record<User['role'], string> = {
  admin: 'Администратор',
  engineer: 'Инженер',
  accountant: 'Бухгалтер',
}

/** Карточки-разделы личного кабинета: цвет (см. выше), иконка и переход по клику. */
export const DASHBOARD_NAV_CARDS: { key: Exclude<PrivatePageKey, 'dashboard'>; title: string; desc: string; icon: string }[] = [
  {
    key: 'learning',
    title: 'Обучение',
    desc: 'Тесты и ИИ-помощник по Таненбауму',
    icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  },
  {
    key: 'warehouse',
    title: 'Склад',
    desc: 'Учёт товаров и перемещений',
    icon: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><path d="M12 22.08V12"/>',
  },
  {
    key: 'docs',
    title: 'Документы',
    desc: 'Корпоративная документация',
    icon: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  },
  {
    key: 'finance',
    title: 'Финансы',
    desc: 'Чеки и отчёты по командировкам',
    icon: '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  },
]
