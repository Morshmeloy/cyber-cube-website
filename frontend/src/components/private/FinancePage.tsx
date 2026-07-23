import { useEffect, useRef, useState } from 'react'
import { getUser } from '@/lib/auth.tsx'
import { getData, setData } from '@/lib/storage.tsx'

interface Expense {
  id: number
  amount: number
  description: string
  date: string
  username: string
  receipt?: string
}

interface FinanceDraft {
  amount: string
  description: string
}

const EMPTY_DRAFT: FinanceDraft = { amount: '', description: '' }

const fieldClass =
  'w-full rounded-md border border-[#e8f8ff]/20 bg-[#0a0c18a6] px-2.5 py-2 font-inherit text-[#e8f8ff] transition-colors focus:border-[var(--plasma-color)] focus:outline-none'
const labelClass = 'mb-1 block text-xs font-semibold text-[#e8f8ff]/70'

/** React-порт settings/navigation/pages/private/finance.ts — чеки/затраты, видимость по роли
 * (admin/accountant видят все, остальные — только свои), черновик формы через lib/storage.ts. */
export function FinancePage() {
  const user = getUser()
  const currentUser = user?.username ?? 'unknown'
  const isAdmin = user?.role === 'admin' || user?.role === 'accountant'

  const [items, setItems] = useState<Expense[]>(() => getData<Expense[]>('finance', []))
  const [draft0] = useState<FinanceDraft>(() => getData<FinanceDraft>('finance_draft', EMPTY_DRAFT))
  const [amount, setAmount] = useState(draft0.amount)
  const [description, setDescription] = useState(draft0.description)
  const [receiptName, setReceiptName] = useState('Файл не выбран')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setData('finance_draft', { amount, description })
  }, [amount, description])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    const parsedAmount = parseFloat(amount)
    const trimmedDesc = description.trim()
    if (!parsedAmount || !trimmedDesc) return

    const newItem: Expense = { id: Date.now(), amount: parsedAmount, description: trimmedDesc, date: new Date().toLocaleString(), username: currentUser }
    const file = fileInputRef.current?.files?.[0]

    function finish(item: Expense): void {
      const next = [...getData<Expense[]>('finance', []), item]
      setData('finance', next)
      setItems(next)
      setAmount('')
      setDescription('')
      setData('finance_draft', EMPTY_DRAFT)
      setReceiptName('Файл не выбран')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }

    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        newItem.receipt = ev.target?.result as string
        finish(newItem)
      }
      reader.readAsDataURL(file)
    } else {
      finish(newItem)
    }
  }

  const filtered = isAdmin ? items : items.filter((item) => item.username === currentUser)

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="mb-5.5 max-w-[480px] rounded-xl border p-4.5"
        style={{ background: 'color-mix(in srgb, var(--plasma-color) 7%, #171b30)', borderColor: 'color-mix(in srgb, var(--plasma-color) 20%, transparent)' }}
      >
        <h3 className="mb-3 text-sm font-bold text-[var(--plasma-color)] [text-shadow:0_0_6px_color-mix(in_srgb,var(--plasma-color)_50%,transparent)]">Добавить чек/затрату</h3>
        <div className="mb-3">
          <label className={labelClass}>Сумма</label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className={fieldClass} />
        </div>
        <div className="mb-3">
          <label className={labelClass}>Описание</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Назначение" required className={fieldClass} />
        </div>
        <div className="mb-3">
          <label className={labelClass}>Чек (изображение)</label>
          <div className="flex items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              id="finance-receipt"
              accept="image/*"
              onChange={(e) => setReceiptName(e.target.files?.[0]?.name ?? 'Файл не выбран')}
              className="absolute h-px w-px overflow-hidden border-0 p-0 whitespace-nowrap [clip:rect(0,0,0,0)]"
            />
            <label
              htmlFor="finance-receipt"
              className="shrink-0 cursor-pointer rounded-md border px-4 py-2 text-xs font-bold tracking-wide text-[var(--plasma-color)] uppercase transition-colors"
              style={{ borderColor: 'var(--plasma-color)', background: 'color-mix(in srgb, var(--plasma-color) 14%, transparent)' }}
            >
              Выбрать файл
            </label>
            <span className="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-[#e8f8ff]/55">{receiptName}</span>
          </div>
        </div>
        <button type="submit" className="rounded-lg border border-[var(--plasma-color)] bg-[var(--plasma-color)] px-5 py-2.5 font-bold text-[#050510]">
          Добавить
        </button>
      </form>

      <div
        className="mb-5.5 overflow-x-auto rounded-xl border p-4"
        style={{ background: 'color-mix(in srgb, var(--plasma-color) 6%, #14172c)', borderColor: 'color-mix(in srgb, var(--plasma-color) 16%, transparent)' }}
      >
        <h3 className="mb-3 text-sm font-bold text-[var(--plasma-color)]">Мои расходы</h3>
        <table className="w-full min-w-[480px] border-collapse text-[13px] text-[#e8f8ff]/85">
          <thead>
            <tr>
              {['#', 'Сумма', 'Описание', 'Дата', 'Кто', 'Чек'].map((h) => (
                <th key={h} className="bg-white/6 px-2.5 py-2 text-left font-bold text-[var(--plasma-color)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, i) => (
              <tr key={item.id} className="hover:bg-white/4">
                <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{i + 1}</td>
                <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{item.amount.toFixed(2)}</td>
                <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{item.description}</td>
                <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{item.date}</td>
                <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">{item.username}</td>
                <td className="border-b border-[#e8f8ff]/8 px-2.5 py-2">
                  {item.receipt ? (
                    <a href={item.receipt} target="_blank" rel="noopener" className="text-[var(--plasma-color)] underline">
                      Просмотр
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
