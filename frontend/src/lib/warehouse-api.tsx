import { apiClient } from './http-client.tsx'

export type MovementType = 'in' | 'out'

export interface WarehouseItem {
  id: number
  name: string
  quantity: number
  movementType: MovementType
  person: string
  date: string
  userId: number
}

interface WarehouseItemDto {
  id: number
  name: string
  quantity: number
  movement_type: MovementType
  person: string
  date: string
  user_id: number
}

function fromDto(dto: WarehouseItemDto): WarehouseItem {
  return {
    id: dto.id,
    name: dto.name,
    quantity: dto.quantity,
    movementType: dto.movement_type,
    person: dto.person,
    date: dto.date,
    userId: dto.user_id,
  }
}

export async function fetchWarehouseItems(): Promise<WarehouseItem[]> {
  const response = await apiClient.get<WarehouseItemDto[]>('/warehouse/')
  return response.data.map(fromDto)
}

export async function fetchWarehouseBalances(): Promise<Record<string, number>> {
  const response = await apiClient.get<Record<string, number>>('/warehouse/balances')
  return response.data
}

export interface WarehouseItemDraft {
  name: string
  quantity: number
  movementType: MovementType
  person: string
}

export async function createWarehouseItem(draft: WarehouseItemDraft): Promise<WarehouseItem> {
  const response = await apiClient.post<WarehouseItemDto>('/warehouse/', {
    name: draft.name,
    quantity: draft.quantity,
    movement_type: draft.movementType,
    person: draft.person,
  })
  return fromDto(response.data)
}

export async function deleteWarehouseItem(id: number): Promise<void> {
  await apiClient.delete(`/warehouse/${id}`)
}
