import { apiClient } from './http-client.tsx'

export interface DocumentItem {
  id: number
  title: string
  originalFilename: string
  contentType: string
  sizeBytes: number
  isPreviewable: boolean
  createdAt: string
  userId: number
  username: string
}

export interface UserDocumentsSummary {
  id: number
  username: string
  fullName: string | null
  documentCount: number
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

interface DocumentDto {
  id: number
  title: string
  original_filename: string
  content_type: string
  size_bytes: number
  is_previewable: boolean
  created_at: string
  user_id: number
  username: string
}

interface UserDocumentsSummaryDto {
  id: number
  username: string
  full_name: string | null
  document_count: number
}

interface PageDto<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

function fromDocumentDto(dto: DocumentDto): DocumentItem {
  return {
    id: dto.id,
    title: dto.title,
    originalFilename: dto.original_filename,
    contentType: dto.content_type,
    sizeBytes: dto.size_bytes,
    isPreviewable: dto.is_previewable,
    createdAt: dto.created_at,
    userId: dto.user_id,
    username: dto.username,
  }
}

function fromUserSummaryDto(dto: UserDocumentsSummaryDto): UserDocumentsSummary {
  return { id: dto.id, username: dto.username, fullName: dto.full_name, documentCount: dto.document_count }
}

function fromPage(dto: PageDto<DocumentDto>): Page<DocumentItem> {
  return { items: dto.items.map(fromDocumentDto), total: dto.total, page: dto.page, pageSize: dto.page_size }
}

export async function uploadDocument(file: File, title: string): Promise<DocumentItem> {
  const form = new FormData()
  form.append('file', file)
  form.append('title', title)
  const response = await apiClient.post<DocumentDto>('/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return fromDocumentDto(response.data)
}

export async function fetchMyDocuments(page = 1, pageSize = 10): Promise<Page<DocumentItem>> {
  const response = await apiClient.get<PageDto<DocumentDto>>('/documents/me', { params: { page, page_size: pageSize } })
  return fromPage(response.data)
}

export async function fetchDocumentsRoster(): Promise<UserDocumentsSummary[]> {
  const response = await apiClient.get<UserDocumentsSummaryDto[]>('/documents/users')
  return response.data.map(fromUserSummaryDto)
}

export async function fetchDocumentsForUser(userId: number, page = 1, pageSize = 10): Promise<Page<DocumentItem>> {
  const response = await apiClient.get<PageDto<DocumentDto>>(`/documents/users/${userId}`, { params: { page, page_size: pageSize } })
  return fromPage(response.data)
}

/** Возвращает blob-URL для инлайн-просмотра (iframe/img) — не запускает скачивание.
 * Прямая навигация браузером (<a href>) сюда не подойдёт: авторизация — Bearer-токен
 * в заголовке, а не cookie, обычная ссылка его не передаст, нужен запрос через apiClient. */
export async function fetchDocumentPreviewUrl(id: number): Promise<string> {
  const response = await apiClient.get(`/documents/${id}/view`, { responseType: 'blob' })
  return URL.createObjectURL(response.data as Blob)
}

export async function downloadDocument(id: number, fallbackFilename: string): Promise<void> {
  const response = await apiClient.get(`/documents/${id}/download`, { responseType: 'blob' })
  const disposition = response.headers['content-disposition'] as string | undefined
  const match = disposition?.match(/filename\*=UTF-8''([^;]+)/i)
  const filename = match ? decodeURIComponent(match[1]) : fallbackFilename

  const url = URL.createObjectURL(response.data as Blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
