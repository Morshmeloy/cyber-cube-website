import { apiClient } from './http-client.tsx'

export type OperationType = 'issue' | 'return'

export interface Nomenclature {
  id: number
  name: string
  code: string | null
  unit: string | null
  baseQuantity: number
  portalQuantity: number
  totalQuantity: number
  baseSyncedAt: string | null
  createdAt: string
}

export interface StockOperation {
  id: number
  uuid: string
  batchId: string | null
  nomenclatureId: number
  nomenclatureName: string
  quantity: number
  operationType: OperationType
  person: string
  destination: string
  userId: number
  username: string
  createdAt: string
  exportedAt: string | null
  confirmedIn1cAt: string | null
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface SyncResult {
  added: number
  updated: number
}

export interface SyncStatus {
  lastSyncedAt: string | null
}

export interface AuditLogEntry {
  id: number
  userId: number
  username: string
  action: string
  entityType: string
  entityId: number | null
  details: Record<string, unknown> | null
  createdAt: string
}

interface NomenclatureDto {
  id: number
  name: string
  code: string | null
  unit: string | null
  base_quantity: number
  portal_quantity: number
  total_quantity: number
  base_synced_at: string | null
  created_at: string
}

interface StockOperationDto {
  id: number
  uuid: string
  batch_id: string | null
  nomenclature_id: number
  nomenclature_name: string
  quantity: number
  operation_type: OperationType
  person: string
  destination: string
  user_id: number
  username: string
  created_at: string
  exported_at: string | null
  confirmed_in_1c_at: string | null
}

interface PageDto<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

interface SyncResultDto {
  added: number
  updated: number
}

interface SyncStatusDto {
  last_synced_at: string | null
}

interface AuditLogDto {
  id: number
  user_id: number
  username: string
  action: string
  entity_type: string
  entity_id: number | null
  details: Record<string, unknown> | null
  created_at: string
}

function fromNomenclatureDto(dto: NomenclatureDto): Nomenclature {
  return {
    id: dto.id,
    name: dto.name,
    code: dto.code,
    unit: dto.unit,
    baseQuantity: dto.base_quantity,
    portalQuantity: dto.portal_quantity,
    totalQuantity: dto.total_quantity,
    baseSyncedAt: dto.base_synced_at,
    createdAt: dto.created_at,
  }
}

function fromOperationDto(dto: StockOperationDto): StockOperation {
  return {
    id: dto.id,
    uuid: dto.uuid,
    batchId: dto.batch_id,
    nomenclatureId: dto.nomenclature_id,
    nomenclatureName: dto.nomenclature_name,
    quantity: dto.quantity,
    operationType: dto.operation_type,
    person: dto.person,
    destination: dto.destination,
    userId: dto.user_id,
    username: dto.username,
    createdAt: dto.created_at,
    exportedAt: dto.exported_at,
    confirmedIn1cAt: dto.confirmed_in_1c_at,
  }
}

function fromAuditDto(dto: AuditLogDto): AuditLogEntry {
  return {
    id: dto.id,
    userId: dto.user_id,
    username: dto.username,
    action: dto.action,
    entityType: dto.entity_type,
    entityId: dto.entity_id,
    details: dto.details,
    createdAt: dto.created_at,
  }
}

export interface NomenclatureFilters {
  query?: string
  page?: number
  pageSize?: number
}

export async function fetchNomenclature(filters: NomenclatureFilters = {}): Promise<Page<Nomenclature>> {
  const response = await apiClient.get<PageDto<NomenclatureDto>>('/warehouse/nomenclature', {
    params: {
      query: filters.query || undefined,
      page: filters.page ?? 1,
      page_size: filters.pageSize ?? 10,
    },
  })
  return {
    items: response.data.items.map(fromNomenclatureDto),
    total: response.data.total,
    page: response.data.page,
    pageSize: response.data.page_size,
  }
}

export async function syncFrom1c(): Promise<SyncResult> {
  const response = await apiClient.post<SyncResultDto>('/warehouse/onec/sync')
  return { added: response.data.added, updated: response.data.updated }
}

export async function fetchSyncStatus(): Promise<SyncStatus> {
  const response = await apiClient.get<SyncStatusDto>('/warehouse/onec/sync-status')
  return { lastSyncedAt: response.data.last_synced_at }
}

/** Имя файла для скачивания берём из заголовка Content-Disposition ответа
 * (там сервер уже прислал настоящее русское имя в filename*=UTF-8''...) —
 * а не задаём жёстко строкой в JS, иначе то, что решил бэкенд, не имеет значения:
 * <a download="..."> при blob-скачивании полностью игнорирует HTTP-заголовки. */
function filenameFromContentDisposition(header: string | undefined, fallback: string): string {
  if (!header) return fallback
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      // ignore, попробуем обычный filename= ниже
    }
  }
  const plainMatch = header.match(/filename="?([^";]+)"?/i)
  return plainMatch ? plainMatch[1] : fallback
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function exportOperations(includeExported = false): Promise<void> {
  const response = await apiClient.get('/warehouse/operations/export', {
    responseType: 'blob',
    params: { include_exported: includeExported },
  })
  const filename = filenameFromContentDisposition(response.headers['content-disposition'], 'operacii.xlsx')
  downloadBlob(response.data as Blob, filename)
}

export interface ExportDocumentDetails {
  invoiceNumber?: string
  contractName?: string
  releasedBy?: string
  receivedBy?: string
}

export async function exportSelectedOperations(ids: number[], details: ExportDocumentDetails = {}): Promise<void> {
  const response = await apiClient.post(
    '/warehouse/operations/export-selected',
    {
      ids,
      invoice_number: details.invoiceNumber || undefined,
      contract_name: details.contractName || undefined,
      released_by: details.releasedBy || undefined,
      received_by: details.receivedBy || undefined,
    },
    { responseType: 'blob' },
  )
  const filename = filenameFromContentDisposition(response.headers['content-disposition'], 'trebovanie-nakladnaya.xlsx')
  downloadBlob(response.data as Blob, filename)
}

export interface OperationFilters {
  query?: string
  dateFrom?: string
  dateTo?: string
  operationType?: OperationType
  person?: string
  destination?: string
  exportStatus?: 'exported' | 'not_exported'
  page?: number
  pageSize?: number
}

export async function fetchOperations(filters: OperationFilters = {}): Promise<Page<StockOperation>> {
  const response = await apiClient.get<PageDto<StockOperationDto>>('/warehouse/operations', {
    params: {
      query: filters.query || undefined,
      date_from: filters.dateFrom || undefined,
      date_to: filters.dateTo || undefined,
      operation_type: filters.operationType || undefined,
      person: filters.person || undefined,
      destination: filters.destination || undefined,
      export_status: filters.exportStatus || undefined,
      page: filters.page ?? 1,
      page_size: filters.pageSize ?? 10,
    },
  })
  return {
    items: response.data.items.map(fromOperationDto),
    total: response.data.total,
    page: response.data.page,
    pageSize: response.data.page_size,
  }
}

export interface BatchOperationLineDraft {
  nomenclatureName: string
  quantity: number
}

export interface BatchOperationDraft {
  lines: BatchOperationLineDraft[]
  operationType: OperationType
  person: string
  destination: string
}

export async function createBatchOperation(draft: BatchOperationDraft): Promise<StockOperation[]> {
  const response = await apiClient.post<StockOperationDto[]>('/warehouse/operations', {
    lines: draft.lines.map((line) => ({ nomenclature_name: line.nomenclatureName, quantity: line.quantity })),
    operation_type: draft.operationType,
    person: draft.person,
    destination: draft.destination,
  })
  return response.data.map(fromOperationDto)
}

export interface StockOperationEditDraft {
  quantity: number
  operationType: OperationType
  person: string
  destination: string
}

export async function updateOperation(id: number, draft: StockOperationEditDraft): Promise<StockOperation> {
  const response = await apiClient.put<StockOperationDto>(`/warehouse/operations/${id}`, {
    quantity: draft.quantity,
    operation_type: draft.operationType,
    person: draft.person,
    destination: draft.destination,
  })
  return fromOperationDto(response.data)
}

export async function deleteOperation(id: number): Promise<void> {
  await apiClient.delete(`/warehouse/operations/${id}`)
}

export async function confirmOperationsIn1c(ids: number[]): Promise<{ count: number }> {
  const response = await apiClient.post<{ count: number }>('/warehouse/operations/confirm-in-1c', { ids })
  return response.data
}

export async function confirmAllExportedIn1c(): Promise<{ count: number }> {
  const response = await apiClient.post<{ count: number }>('/warehouse/operations/confirm-all-exported')
  return response.data
}

export async function unconfirmOperationIn1c(id: number): Promise<StockOperation> {
  const response = await apiClient.post<StockOperationDto>(`/warehouse/operations/${id}/unconfirm-in-1c`)
  return fromOperationDto(response.data)
}

export async function fetchAuditLog(): Promise<AuditLogEntry[]> {
  const response = await apiClient.get<AuditLogDto[]>('/warehouse/audit-log')
  return response.data.map(fromAuditDto)
}
