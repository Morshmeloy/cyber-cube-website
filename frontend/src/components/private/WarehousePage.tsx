import { useEffect, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { getData, setData } from '@/lib/storage.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'
import {
  fetchWarehouseItems,
  fetchWarehouseBalances,
  createWarehouseItem,
  deleteWarehouseItem,
  type WarehouseItem,
  type MovementType,
} from '@/lib/warehouse-api.tsx'

interface WarehouseDraft {
  name: string
  quantity: string
  type: MovementType
  person: string
}

const EMPTY_DRAFT: WarehouseDraft = { name: '', quantity: '', type: 'in', person: '' }

const fieldClass =
  'w-full rounded-md border border-[#e8f8ff]/20 bg-[#0a0c18a6] px-2.5 py-2 font-inherit text-[#e8f8ff] transition-colors focus:border-[var(--plasma-color)] focus:outline-none'
const labelClass = 'mb-1 block text-xs font-semibold text-[#e8f8ff]/70'

function formatDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 403) return 'Только администратор может выполнять это действие.'
    if (error.response?.status === 422) return 'Количество должно быть больше 0.'
    if (!error.response) return 'Не удалось подключиться к серверу.'
  }
  return fallback
}

/** Учёт прихода/расхода — данные о записях и остатках приходят с бэкенда
 * (src/routes/warehouse.py), user_id подставляется сервером из access-токена.
 * Черновик формы (незаполненные поля) — единственное, что остаётся в localStorage
 * (lib/storage.ts): это не доменные данные, а просто UX-удобство при перезагрузке. */
export function WarehousePage() {
  const [items, setItems] = useState<WarehouseItem[] | null>(null)
  const [balances, setBalances] = useState<Record<string, number> | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [draft0] = useState<WarehouseDraft>(() => getData<WarehouseDraft>('warehouse_draft', EMPTY_DRAFT))
  const [name, setName] = useState(draft0.name)
  const [quantity, setQuantity] = useState(draft0.quantity)
  const [type, setType] = useState<MovementType>(draft0.type)
  const [person, setPerson] = useState(draft0.person)

  useEffect(() => {
    setData<WarehouseDraft>('warehouse_draft', { name, quantity, type, person })
  }, [name, quantity, type, person])

  async function loadData(): Promise<void> {
    setRefreshing(true)
    try {
      const [nextItems, nextBalances] = await Promise.all([fetchWarehouseItems(), fetchWarehouseBalances()])
      setItems(nextItems)
      setBalances(nextBalances)
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось загрузить данные склада.'))
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadData()
    })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedPerson = person.trim()
    const qty = Number(quantity)
    if (!trimmedName || !quantity || Number.isNaN(qty) || !trimmedPerson) return

    setSubmitting(true)
    try {
      await createWarehouseItem({ name: trimmedName, quantity: qty, movementType: type, person: trimmedPerson })
      setName('')
      setQuantity('')
      setType('in')
      setPerson('')
      setData('warehouse_draft', EMPTY_DRAFT)
      await loadData()
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось добавить запись.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number): Promise<void> {
    setDeletingId(id)
    try {
      await deleteWarehouseItem(id)
      await loadData()
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось удалить запись.'))
    } finally {
      setDeletingId(null)
    }
  }

  const balanceEntries = Object.entries(balances ?? {})

  return (
    <div>
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="mb-5.5 max-w-[480px] rounded-xl border p-4.5"
        style={{ background: 'color-mix(in srgb, var(--plasma-color) 7%, #171b30)', borderColor: 'color-mix(in srgb, var(--plasma-color) 20%, transparent)' }}
      >
        <h3 className="mb-3 text-sm font-bold text-[var(--plasma-color)] [text-shadow:0_0_6px_color-mix(in_srgb,var(--plasma-color)_50%,transparent)]">Добавить запись</h3>
        <div className="mb-3">
          <label className={labelClass}>Товар</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Наименование" required className={fieldClass} />
        </div>
        <div className="mb-3">
          <label className={labelClass}>Количество</label>
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className={fieldClass} />
        </div>
        <div className="mb-3">
          <label className={labelClass}>Тип</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MovementType)}
            className={`${fieldClass} cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg_xmlns=%27http://www.w3.org/2000/svg%27_viewBox=%270_0_24_24%27_fill=%27none%27_stroke=%27%2300ffff%27_stroke-width=%272%27_stroke-linecap=%27round%27_stroke-linejoin=%27round%27%3E%3Cpolyline_points=%276_9_12_15_18_9%27/%3E%3C/svg%3E')] bg-[position:right_10px_center] bg-no-repeat pr-8.5`}
          >
            <option value="in">Приход</option>
            <option value="out">Расход</option>
          </select>
        </div>
        <div className="mb-3">
          <label className={labelClass}>Кто взял/вернул</label>
          <input type="text" value={person} onChange={(e) => setPerson(e.target.value)} placeholder="ФИО" required className={fieldClass} />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg border border-[var(--plasma-color)] bg-[var(--plasma-color)] px-5 py-2.5 font-bold text-[#050510] disabled:opacity-60"
        >
          {submitting && <Spinner className="h-4 w-4" />}
          Добавить
        </button>
      </form>

      <div
        className="mb-5.5 overflow-x-auto rounded-xl border p-4"
        style={{ background: 'color-mix(in srgb, var(--plasma-color) 6%, #14172c)', borderColor: 'color-mix(in srgb, var(--plasma-color) 16%, transparent)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--plasma-color)]">История операций</h3>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-md border border-[#e8f8ff]/20 px-2.5 py-1.5 text-[12px] text-[#e8f8ff]/80 transition-colors hover:bg-white/6 disabled:opacity-50"
          >
            {refreshing && <Spinner className="h-3.5 w-3.5" />}
            Обновить
          </button>
        </div>

        {items === null ? (
          <div className="flex items-center gap-2 py-4 text-sm text-[#e8f8ff]/70">
            <Spinner className="h-4 w-4" />
            Загрузка…
          </div>
        ) : (
          <table className="w-full min-w-[560px] border-collapse text-[13px] text-[#e8f8ff]/85">
            <thead>
              <tr>
                {['#', 'Товар', 'Кол-во', 'Тип', 'Дата', 'Кто', 'Действия'].map((h) => (
                  <th key={h} className="bg-white/6 px-2.5 py-2 text-left font-bold text-[var(--plasma-color)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} className="hover:bg-white/4">
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{i + 1}</td>
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{item.name}</td>
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{item.quantity}</td>
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{item.movementType === 'in' ? '📥 Приход' : '📤 Расход'}</td>
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{formatDate(item.date)}</td>
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{item.person}</td>
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">
                    <button
                      type="button"
                      disabled={deletingId === item.id}
                      onClick={() => void handleDelete(item.id)}
                      className="flex items-center gap-1.5 rounded-md border border-red-400/35 px-2.5 py-1 text-[11px] text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                    >
                      {deletingId === item.id && <Spinner className="h-3 w-3" />}
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2.5 py-4 text-center text-[#e8f8ff]/50">
                    Записей пока нет.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        <h3 className="mt-5 mb-3 text-sm font-bold text-[var(--plasma-color)]">Остатки по товарам</h3>
        {items === null ? (
          <div className="flex items-center gap-2 py-2 text-sm text-[#e8f8ff]/70">
            <Spinner className="h-4 w-4" />
            Загрузка…
          </div>
        ) : (
          <table className="w-full min-w-[480px] border-collapse text-[13px] text-[#e8f8ff]/85">
            <thead>
              <tr>
                {['Товар', 'Остаток'].map((h) => (
                  <th key={h} className="bg-white/6 px-2.5 py-2 text-left font-bold text-[var(--plasma-color)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {balanceEntries.map(([n, qty]) => (
                <tr key={n} className="hover:bg-white/4">
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{n}</td>
                  <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{qty}</td>
                </tr>
              ))}
              {balanceEntries.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-2.5 py-4 text-center text-[#e8f8ff]/50">
                    Остатков пока нет.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
