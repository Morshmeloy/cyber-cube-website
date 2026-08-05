import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import { createBatchOperation, fetchNomenclature, type OperationType } from '@/lib/warehouse-api.tsx'
import { Spinner } from '@/components/ui/spinner.tsx'
import { fieldClass, formPanelStyle, labelClass, extractErrorMessage, selectClass } from './shared.tsx'

interface LineDraft {
  key: number
  name: string
  quantity: string
}

let nextKey = 1
function emptyLine(): LineDraft {
  return { key: nextKey++, name: '', quantity: '' }
}

interface OperationFormProps {
  onCreated: () => void
}

/** Несколько позиций (номенклатура+количество) одним действием — один поход на склад,
 * одна пачка (batch_id на бэке), но каждая строка может относиться к разной номенклатуре.
 * Проверка «похожих названий» из старой одиночной формы тут сознательно убрана — для
 * N динамических строк она была бы громоздкой; подсказку по существующим названиям
 * даёт datalist (автодополнение браузера). */
export function OperationForm({ onCreated }: OperationFormProps) {
  const [nomenclatureNames, setNomenclatureNames] = useState<string[]>([])
  const [operationType, setOperationType] = useState<OperationType>('issue')
  const [person, setPerson] = useState('')
  const [destination, setDestination] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchNomenclature({ page: 1, pageSize: 1000 })
      .then((res) => setNomenclatureNames(res.items.map((i) => i.name)))
      .catch(() => {})
  }, [])

  function updateLine(key: number, patch: Partial<LineDraft>): void {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function addLine(): void {
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(key: number): void {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    const trimmedPerson = person.trim()
    const trimmedDestination = destination.trim()
    const preparedLines = lines
      .map((l) => ({ nomenclatureName: l.name.trim(), quantity: Number(l.quantity) }))
      .filter((l) => l.nomenclatureName && !Number.isNaN(l.quantity) && l.quantity > 0)

    if (!trimmedPerson || !trimmedDestination || preparedLines.length === 0) {
      toast.error('Заполни ФИО, адрес и хотя бы одну позицию с количеством.')
      return
    }

    setSubmitting(true)
    try {
      const created = await createBatchOperation({
        lines: preparedLines,
        operationType,
        person: trimmedPerson,
        destination: trimmedDestination,
      })
      setLines([emptyLine()])
      setPerson('')
      setDestination('')
      onCreated()
      toast.success(`Добавлено позиций: ${created.length}.`)
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Не удалось создать операцию.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mb-5.5 max-w-[720px] rounded-xl border p-4.5" style={formPanelStyle}>
      <h3 className="mb-3 text-sm font-bold text-[var(--plasma-color)] [text-shadow:0_0_6px_color-mix(in_srgb,var(--plasma-color)_50%,transparent)]">
        Добавить операцию
      </h3>

      <datalist id="nomenclature-options">
        {nomenclatureNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Тип операции</label>
          <select value={operationType} onChange={(e) => setOperationType(e.target.value as OperationType)} className={selectClass}>
            <option value="issue">Выдача</option>
            <option value="return">Возврат</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>ФИО сотрудника</label>
          <input type="text" value={person} onChange={(e) => setPerson(e.target.value)} placeholder="ФИО" required className={fieldClass} />
        </div>
      </div>
      <div className="mb-3.5">
        <label className={labelClass}>Адрес/место назначения</label>
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Куда/откуда"
          required
          className={fieldClass}
        />
      </div>

      <label className={labelClass}>Позиции</label>
      <div className="mb-3 space-y-2">
        {lines.map((line) => (
          <div key={line.key} className="flex items-center gap-2">
            <input
              type="text"
              list="nomenclature-options"
              value={line.name}
              onChange={(e) => updateLine(line.key, { name: e.target.value })}
              placeholder="Название товара"
              className={`${fieldClass} flex-1`}
            />
            <input
              type="number"
              value={line.quantity}
              onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
              placeholder="Кол-во"
              className={`${fieldClass} w-28`}
            />
            <button
              type="button"
              onClick={() => removeLine(line.key)}
              disabled={lines.length === 1}
              className="shrink-0 rounded-md border border-red-400/35 px-2.5 py-2 text-[13px] text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-30"
              aria-label="Убрать позицию"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addLine}
          className="rounded-md border border-[#e8f8ff]/20 px-3 py-2 text-[13px] text-[#e8f8ff]/80 transition-colors hover:bg-white/6"
        >
          + Ещё позиция
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg border border-[var(--plasma-color)] bg-[var(--plasma-color)] px-5 py-2.5 font-bold text-[#050510] disabled:opacity-60"
        >
          {submitting && <Spinner className="h-4 w-4" />}
          Сохранить
        </button>
      </div>
    </form>
  )
}
