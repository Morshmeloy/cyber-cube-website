import { useEffect, useState } from 'react'
import { getData, setData } from '@/lib/storage.tsx'

interface WarehouseItem {
  id: number
  name: string
  quantity: number
  type: 'in' | 'out'
  date: string
  person: string
}

interface WarehouseDraft {
  name: string
  quantity: string
  type: 'in' | 'out'
  person: string
}

const EMPTY_DRAFT: WarehouseDraft = { name: '', quantity: '', type: 'in', person: '' }
const STORAGE_KEY = 'd4_warehouse'

function getItems(): WarehouseItem[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as WarehouseItem[]
  } catch {
    return []
  }
}

function setItems(items: WarehouseItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

const fieldClass =
  'w-full rounded-md border border-[#e8f8ff]/20 bg-[#0a0c18a6] px-2.5 py-2 font-inherit text-[#e8f8ff] transition-colors focus:border-[var(--plasma-color)] focus:outline-none'
const labelClass = 'mb-1 block text-xs font-semibold text-[#e8f8ff]/70'

/** React-порт settings/navigation/pages/private/warehouse.ts — учёт прихода/расхода,
 * данные в localStorage (не по пользователю — общий склад, как и раньше), черновик формы
 * персонально по пользователю через lib/storage.ts. */
export function WarehousePage() {
  const [items, setItemsState] = useState<WarehouseItem[]>(() => getItems())
  const draft0 = getData<WarehouseDraft>('warehouse_draft', EMPTY_DRAFT)
  const [name, setName] = useState(draft0.name)
  const [quantity, setQuantity] = useState(draft0.quantity)
  const [type, setType] = useState<'in' | 'out'>(draft0.type)
  const [person, setPerson] = useState(draft0.person)

  useEffect(() => {
    setData<WarehouseDraft>('warehouse_draft', { name, quantity, type, person })
  }, [name, quantity, type, person])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    const trimmedName = name.trim()
    const qty = parseInt(quantity, 10)
    const trimmedPerson = person.trim()
    if (!trimmedName || !qty || !trimmedPerson) return

    const next = [...items, { id: Date.now(), name: trimmedName, quantity: qty, type, date: new Date().toLocaleString(), person: trimmedPerson }]
    setItemsState(next)
    setItems(next)
    setName('')
    setQuantity('')
    setType('in')
    setPerson('')
    setData('warehouse_draft', EMPTY_DRAFT)
  }

  const summary: Record<string, number> = {}
  for (const item of items) {
    const delta = item.type === 'in' ? item.quantity : -item.quantity
    summary[item.name] = (summary[item.name] ?? 0) + delta
  }
  const summaryEntries = Object.entries(summary).filter(([, qty]) => qty !== 0)

  return (
    <div>
      <form
        onSubmit={handleSubmit}
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
          <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className={fieldClass} />
        </div>
        <div className="mb-3">
          <label className={labelClass}>Тип</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'in' | 'out')}
            className={`${fieldClass} cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg_xmlns=%27http://www.w3.org/2000/svg%27_viewBox=%270_0_24_24%27_fill=%27none%27_stroke=%27%2300ffff%27_stroke-width=%272%27_stroke-linecap=%27round%27_stroke-linejoin=%27round%27%3E%3Cpolyline_points=%276_9_12_15_18_9%27/%3E%3C/svg%3E')] bg-[position:right_10px_center] bg-no-repeat pr-8.5`}
          >
            <option value="in">Прибытие</option>
            <option value="out">Отбытие</option>
          </select>
        </div>
        <div className="mb-3">
          <label className={labelClass}>Кто взял/вернул</label>
          <input type="text" value={person} onChange={(e) => setPerson(e.target.value)} placeholder="ФИО" required className={fieldClass} />
        </div>
        <button
          type="submit"
          className="rounded-lg border border-[var(--plasma-color)] bg-[var(--plasma-color)] px-5 py-2.5 font-bold text-[#050510]"
        >
          Добавить
        </button>
      </form>

      <div
        className="mb-5.5 overflow-x-auto rounded-xl border p-4"
        style={{ background: 'color-mix(in srgb, var(--plasma-color) 6%, #14172c)', borderColor: 'color-mix(in srgb, var(--plasma-color) 16%, transparent)' }}
      >
        <h3 className="mb-3 text-sm font-bold text-[var(--plasma-color)]">История операций</h3>
        <table className="w-full min-w-[480px] border-collapse text-[13px] text-[#e8f8ff]/85">
          <thead>
            <tr>
              {['#', 'Товар', 'Кол-во', 'Тип', 'Дата', 'Кто'].map((h) => (
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
                <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{item.type === 'in' ? '📥 Прибытие' : '📤 Отбытие'}</td>
                <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{item.date}</td>
                <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{item.person}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="mt-5 mb-3 text-sm font-bold text-[var(--plasma-color)]">Остатки по товарам</h3>
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
            {summaryEntries.map(([n, qty]) => (
              <tr key={n} className="hover:bg-white/4">
                <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{n}</td>
                <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
