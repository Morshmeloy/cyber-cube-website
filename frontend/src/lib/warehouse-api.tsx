import { apiClient } from './http-client.tsx'

export type OperationType = 'issue' | 'return'

export interface Nomenclature {
  id: number
  name: string
  baseQuantity: number
  portalQuantity: number
  totalQuantity: number
  baseSyncedAt: string | null
  createdAt: string
}

export interface StockOperation {
  id: number
  uuid: string
  nomenclatureId: number
  nomenclatureName: string
  quantity: number
  operationType: OperationType
  person: string
  destination: string
  userId: number
  username: string
  createdAt: string
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
  base_quantity: number
  portal_quantity: number
  total_quantity: number
  base_synced_at: string | null
  created_at: string
}

interface StockOperationDto {
  id: number
  uuid: string
  nomenclature_id: number
  nomenclature_name: string
  quantity: number
  operation_type: OperationType
  person: string
  destination: string
  user_id: number
  username: string
  created_at: string
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
    nomenclatureId: dto.nomenclature_id,
    nomenclatureName: dto.nomenclature_name,
    quantity: dto.quantity,
    operationType: dto.operation_type,
    person: dto.person,
    destination: dto.destination,
    userId: dto.user_id,
    username: dto.username,
    createdAt: dto.created_at,
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

export async function fetchNomenclature(): Promise<Nomenclature[]> {
  const response = await apiClient.get<NomenclatureDto[]>('/warehouse/nomenclature')
  return response.data.map(fromNomenclatureDto)
}

export async function syncFrom1c(): Promise<SyncResult> {
  const response = await apiClient.post<SyncResultDto>('/warehouse/onec/sync')
  return { added: response.data.added, updated: response.data.updated }
}

export async function fetchSyncStatus(): Promise<SyncStatus> {
  const response = await apiClient.get<SyncStatusDto>('/warehouse/onec/sync-status')
  return { lastSyncedAt: response.data.last_synced_at }
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

export async function exportOperations(): Promise<void> {
  const response = await apiClient.get('/warehouse/operations/export', { responseType: 'blob' })
  downloadBlob(response.data as Blob, 'operacii.xlsx')
}

export async function fetchOperations(): Promise<StockOperation[]> {
  const response = await apiClient.get<StockOperationDto[]>('/warehouse/operations')
  return response.data.map(fromOperationDto)
}

export interface StockOperationDraft {
  nomenclatureName: string
  quantity: number
  operationType: OperationType
  person: string
  destination: string
}

export async function createOperation(draft: StockOperationDraft): Promise<StockOperation> {
  const response = await apiClient.post<StockOperationDto>('/warehouse/operations', {
    nomenclature_name: draft.nomenclatureName,
    quantity: draft.quantity,
    operation_type: draft.operationType,
    person: draft.person,
    destination: draft.destination,
  })
  return fromOperationDto(response.data)
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

export async function fetchAuditLog(): Promise<AuditLogEntry[]> {
  const response = await apiClient.get<AuditLogDto[]>('/warehouse/audit-log')
  return response.data.map(fromAuditDto)
}
