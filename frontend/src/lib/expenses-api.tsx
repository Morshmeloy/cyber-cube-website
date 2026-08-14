import { apiClient } from './http-client.tsx'

export interface ExpenseItem {
  id: number
  amount: number | null
  description: string | null
  originalFilename: string
  contentType: string
  sizeBytes: number
  isPreviewable: boolean
  createdAt: string
  userId: number
  username: string
}

export interface UserExpensesSummary {
  id: number
  username: string
  fullName: string | null
  expenseCount: number
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

interface ExpenseDto {
  id: number
  amount: number | null
  description: string | null
  original_filename: string
  content_type: string
  size_bytes: number
  is_previewable: boolean
  created_at: string
  user_id: number
  username: string
}

interface UserExpensesSummaryDto {
  id: number
  username: string
  full_name: string | null
  expense_count: number
}

interface PageDto<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

function fromExpenseDto(dto: ExpenseDto): ExpenseItem {
  return {
    id: dto.id,
    amount: dto.amount,
    description: dto.description,
    originalFilename: dto.original_filename,
    contentType: dto.content_type,
    sizeBytes: dto.size_bytes,
    isPreviewable: dto.is_previewable,
    createdAt: dto.created_at,
    userId: dto.user_id,
    username: dto.username,
  }
}

function fromUserSummaryDto(dto: UserExpensesSummaryDto): UserExpensesSummary {
  return { id: dto.id, username: dto.username, fullName: dto.full_name, expenseCount: dto.expense_count }
}

function fromPage(dto: PageDto<ExpenseDto>): Page<ExpenseItem> {
  return { items: dto.items.map(fromExpenseDto), total: dto.total, page: dto.page, pageSize: dto.page_size }
}

export async function uploadExpense(file: File, amount: string, description: string): Promise<ExpenseItem> {
  const form = new FormData()
  form.append('file', file)
  if (amount.trim()) form.append('amount', amount.trim())
  if (description.trim()) form.append('description', description.trim())
  const response = await apiClient.post<ExpenseDto>('/expenses', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return fromExpenseDto(response.data)
}

export async function fetchMyExpenses(page = 1, pageSize = 10): Promise<Page<ExpenseItem>> {
  const response = await apiClient.get<PageDto<ExpenseDto>>('/expenses/me', { params: { page, page_size: pageSize } })
  return fromPage(response.data)
}

export async function fetchExpensesRoster(): Promise<UserExpensesSummary[]> {
  const response = await apiClient.get<UserExpensesSummaryDto[]>('/expenses/users')
  return response.data.map(fromUserSummaryDto)
}

export async function fetchExpensesForUser(userId: number, page = 1, pageSize = 10): Promise<Page<ExpenseItem>> {
  const response = await apiClient.get<PageDto<ExpenseDto>>(`/expenses/users/${userId}`, { params: { page, page_size: pageSize } })
  return fromPage(response.data)
}

/** Возвращает blob-URL для инлайн-просмотра (iframe/img) — не запускает скачивание.
 * Прямая навигация браузером (<a href>) сюда не подойдёт: авторизация — Bearer-токен
 * в заголовке, а не cookie, обычная ссылка его не передаст, нужен запрос через apiClient. */
export async function fetchExpensePreviewUrl(id: number): Promise<string> {
  const response = await apiClient.get(`/expenses/${id}/view`, { responseType: 'blob' })
  return URL.createObjectURL(response.data as Blob)
}

export async function downloadExpenseFile(id: number, fallbackFilename: string): Promise<void> {
  const response = await apiClient.get(`/expenses/${id}/download`, { responseType: 'blob' })
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
