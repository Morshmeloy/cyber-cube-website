import type { FaceName } from '../../../types/navigation.ts'
import type { PageContent } from '../../../types/page-content.ts'
import { authPageContent } from './auth.ts'
import { aboutPageContent } from './about.ts'
import { servicesPageContent } from './services.ts'
import { softwarePageContent } from './software.ts'
import { supportPageContent } from './support.ts'
import { contactsPageContent } from './contacts.ts'

/** Контент страницы, открывающейся по клику на каждую из шести граней куба. */
export const pageContentByFace: Record<FaceName, PageContent> = {
  front: authPageContent,
  back: aboutPageContent,
  right: servicesPageContent,
  left: softwarePageContent,
  top: supportPageContent,
  bottom: contactsPageContent,
}
