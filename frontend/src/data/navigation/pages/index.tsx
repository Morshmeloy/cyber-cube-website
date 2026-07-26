import type { FaceName } from '../../../types/navigation.tsx'
import type { PageContent } from '../../../types/page-content.tsx'
import { aboutPageContent } from './about.tsx'
import { servicesPageContent } from './services.tsx'
import { softwarePageContent } from './software.tsx'
import { supportPageContent } from './support.tsx'
import { contactsPageContent } from './contacts.tsx'

/** Контент страницы, открывающейся по клику на каждую из шести граней куба. Грань 'front'
 * сюда не входит — она всегда ведёт на форму входа (components/auth/LoginForm.tsx),
 * которую AppRoot.tsx строит отдельно. */
export const pageContentByFace: Record<Exclude<FaceName, 'front'>, PageContent> = {
  back: aboutPageContent,
  right: servicesPageContent,
  left: softwarePageContent,
  top: supportPageContent,
  bottom: contactsPageContent,
}
