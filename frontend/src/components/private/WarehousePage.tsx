import { useState } from 'react'
import { toast } from 'sonner'
import { getUser } from '@/lib/auth.tsx'
import { fetchAuditLog, fetchSyncStatus, syncFrom1c, type AuditLogEntry } from '@/lib/warehouse-api.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'
import { NomenclatureTable } from './warehouse/NomenclatureTable.tsx'
import { OperationsTable } from './warehouse/OperationsTable.tsx'
import { OperationForm } from './warehouse/OperationForm.tsx'
import { ExportPanel } from './warehouse/ExportPanel.tsx'
import { ExportHistoryPanel } from './warehouse/ExportHistoryPanel.tsx'
import { extractErrorMessage, formatDate, panelClass, panelStyle, secondaryButtonClass } from './warehouse/shared.tsx'

/** Человекочитаемое описание записи журнала аудита — action/entity_type/JSON из БД
 * не показываем напрямую, собираем из них обычное русское предложение. */
function describeAuditEntry(entry: AuditLogEntry): string {
  const details = (entry.details ?? {}) as Record<string, unknown>
  function operationTypeWord(type: unknown): string {
    return type === 'return' ? 'возврат' : 'выдача'
  }
  switch (entry.action) {
    case 'nomenclature_synced':
      return `Синхронизировал номенклатуру и остатки с 1С — добавлено ${details.added ?? 0}, обновлено ${details.updated ?? 0} (всего в 1С: ${details.total ?? 0}).`
    case 'operations_exported':
    case 'nomenclature_exported':
      return `Экспортировал операции (${details.count ?? 0} записей).`
    case 'operations_confirmed_in_1c':
      return `Подтвердил перенос в 1С для ${details.count ?? 0} операций.`
    case 'operation_unconfirmed_in_1c':
      return 'Отменил подтверждение переноса операции в 1С.'
    case 'operation_created':
      return `Добавил операцию: ${operationTypeWord(details.operation_type)} «${details.nomenclature ?? '—'}», ${details.quantity ?? '?'} шт.`
    case 'operation_updated': {
      const before = (details.before ?? {}) as Record<string, unknown>
      return `Изменил операцию — до правки было: ${operationTypeWord(before.operation_type)} «${before.nomenclature ?? '—'}», ${before.quantity ?? '?'} шт., ${before.person ?? ''}.`
    }
    case 'operation_deleted':
      return `Удалил операцию: ${operationTypeWord(details.operation_type)} «${details.nomenclature ?? '—'}», ${details.quantity ?? '?'} шт., ${details.person ?? ''}.`
    default:
      return entry.action
  }
}

/** Устаревание данных (п. 5.4.2 ТЗ) показываем не порогом/предупреждением, а самим
 * прошедшим временем — пользователь сам решает, насколько это давно. */
function formatSyncStatus(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return 'Ещё не синхронизировано с 1С'
  const diffMs = Date.now() - new Date(lastSyncedAt).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Последняя синхронизация: меньше минуты назад'
  if (minutes < 60) return `Последняя синхронизация: ${minutes} мин. назад`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Последняя синхронизация: ${hours} ч. назад`
  const days = Math.floor(hours / 24)
  return `Последняя синхронизация: ${days} дн. назад`
}

/** Складской учёт по ТЗ: номенклатура и базовые остатки приходят из 1С, операции
 * выдачи/возврата ведутся на портале. Доступ по правам роли
 * (canManageWarehouseOperations/canSyncWarehouse1c/canViewWarehouse), не по
 * фиксированному admin — см. src/services/warehouse_service.py. */
export function WarehousePage() {
  const role = getUser()?.role
  const canManageOps = !!role && (role.isSystem || role.canManageWarehouseOperations)
  const canSync = !!role && (role.isSystem || role.canSyncWarehouse1c)
  const canView = !!role && (role.isSystem || role.canViewWarehouse)

  const [refreshToken, setRefreshToken] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const [showAudit, setShowAudit] = useState(false)
  const [auditLog, setAuditLog] = useState<AuditLogEntry[] | null>(null)

  function bumpRefresh(): void {
    setRefreshToken((t) => t + 1)
  }

  async function loadSyncStatus(): Promise<void> {
    try {
      const status = await fetchSyncStatus()
      setLastSyncedAt(status.lastSyncedAt)
    } catch {
      // молча — статус синка не критичен для остального экрана
    }
  }

  async function handleManualRefresh(): Promise<void> {
    setManualRefreshing(true)
    await loadSyncStatus()
    bumpRefresh()
    setManualRefreshing(false)
  }

  async function handleSync(): Promise<void> {
    setSyncing(true)
    try {
      const result = await syncFrom1c()
      toast.success(`Синхронизация завершена: добавлено ${result.added}, обновлено ${result.updated}.`)
      await loadSyncStatus()
      bumpRefresh()
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось синхронизироваться с 1С.'))
    } finally {
      setSyncing(false)
    }
  }

  async function toggleAudit(): Promise<void> {
    const next = !showAudit
    setShowAudit(next)
    if (next && auditLog === null) {
      try {
        setAuditLog(await fetchAuditLog())
      } catch (error) {
        toast.error(extractErrorMessage(error, 'Не удалось загрузить журнал аудита.'))
      }
    }
  }

  return (
    <div>
      {canManageOps && <OperationForm onCreated={bumpRefresh} />}

      <NomenclatureTable
        refreshToken={refreshToken}
        syncStatusLabel={formatSyncStatus(lastSyncedAt)}
        onManualRefresh={() => void handleManualRefresh()}
        manualRefreshing={manualRefreshing}
        canSync={canSync}
        onSync={() => void handleSync()}
        syncing={syncing}
      />

      <OperationsTable refreshToken={refreshToken} canManageOps={canManageOps} onDataChanged={bumpRefresh} />

      {canManageOps && <ExportPanel refreshToken={refreshToken} onExported={bumpRefresh} />}

      {canManageOps && <ExportHistoryPanel refreshToken={refreshToken} />}

      {canView && (
        <div className={panelClass} style={panelStyle}>
          <button type="button" onClick={() => void toggleAudit()} className={secondaryButtonClass}>
            {showAudit ? 'Скрыть журнал аудита' : 'Показать журнал аудита'}
          </button>

          {showAudit && (
            <div className="mt-3.5">
              {auditLog === null ? (
                <div className="flex items-center gap-2 py-2 text-sm text-[#e8f8ff]/70">
                  <Spinner className="h-4 w-4" />
                  Загрузка…
                </div>
              ) : (
                <table className="w-full min-w-[640px] border-collapse text-[13px] text-[#e8f8ff]/85">
                  <thead>
                    <tr>
                      {['Дата', 'Пользователь', 'Что сделал'].map((h) => (
                        <th key={h} className="bg-white/6 px-2.5 py-2 text-left font-bold text-[var(--plasma-color)]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((entry) => (
                      <tr key={entry.id} className="hover:bg-white/4">
                        <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2 whitespace-nowrap">{formatDate(entry.createdAt)}</td>
                        <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2 whitespace-nowrap">{entry.username}</td>
                        <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{describeAuditEntry(entry)}</td>
                      </tr>
                    ))}
                    {auditLog.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-2.5 py-4 text-center text-[#e8f8ff]/50">
                          Журнал пуст.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
