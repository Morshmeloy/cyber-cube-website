import type { PageContent } from '../../../../types/page-content.ts'
import { getUser } from '../../../../lib/auth.ts'
import { getData, setData } from '../../../../lib/storage.ts'

interface Expense {
  id: number
  amount: number
  description: string
  date: string
  username: string
  receipt?: string
}

function renderFinance(): HTMLElement {
  const user = getUser()
  const currentUser = user?.username ?? 'unknown'
  const isAdmin = user?.role === 'admin' || user?.role === 'accountant'

  const container = document.createElement('div')
  container.className = 'finance-container'

  const form = document.createElement('form')
  form.className = 'finance-form'
  form.innerHTML = `
    <h3>Добавить чек/затрату</h3>
    <div class="form-group">
      <label>Сумма</label>
      <input type="number" id="finance-amount" step="0.01" required>
    </div>
    <div class="form-group">
      <label>Описание</label>
      <input type="text" id="finance-desc" placeholder="Назначение" required>
    </div>
    <div class="form-group">
      <label>Чек (изображение)</label>
      <div class="file-input">
        <input type="file" id="finance-receipt" accept="image/*" class="file-input-native">
        <label for="finance-receipt" class="file-input-button">Выбрать файл</label>
        <span class="file-input-name">Файл не выбран</span>
      </div>
    </div>
    <button type="submit" class="btn-primary">Добавить</button>
  `
  container.appendChild(form)

  const tableWrapper = document.createElement('div')
  tableWrapper.className = 'finance-table-wrapper'
  tableWrapper.innerHTML = `<h3>Мои расходы</h3><table class="finance-table"><thead><tr><th>#</th><th>Сумма</th><th>Описание</th><th>Дата</th><th>Кто</th><th>Чек</th></tr></thead><tbody id="finance-tbody"></tbody></table>`
  container.appendChild(tableWrapper)

  const amountInput = form.querySelector<HTMLInputElement>('#finance-amount')!
  const descInput = form.querySelector<HTMLInputElement>('#finance-desc')!
  const receiptInput = form.querySelector<HTMLInputElement>('#finance-receipt')!
  const receiptNameEl = form.querySelector<HTMLElement>('.file-input-name')!
  const tbody = tableWrapper.querySelector('#finance-tbody')!

  receiptInput.addEventListener('change', () => {
    receiptNameEl.textContent = receiptInput.files?.[0]?.name ?? 'Файл не выбран'
  })

  function renderTable(): void {
    const data = getData<Expense[]>('finance', [])
    const filtered = isAdmin ? data : data.filter((item) => item.username === currentUser)
    tbody.innerHTML = filtered
      .map(
        (item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.amount.toFixed(2)}</td>
        <td>${item.description}</td>
        <td>${item.date}</td>
        <td>${item.username}</td>
        <td>${item.receipt ? `<a href="${item.receipt}" target="_blank">Просмотр</a>` : '—'}</td>
      </tr>
    `,
      )
      .join('')
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const amount = parseFloat(amountInput.value)
    const description = descInput.value.trim()
    if (!amount || !description) return

    const data = getData<Expense[]>('finance', [])
    const newItem: Expense = { id: Date.now(), amount, description, date: new Date().toLocaleString(), username: currentUser }

    const file = receiptInput.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        newItem.receipt = e.target?.result as string
        data.push(newItem)
        setData('finance', data)
        renderTable()
        form.reset()
        receiptNameEl.textContent = 'Файл не выбран'
      }
      reader.readAsDataURL(file)
    } else {
      data.push(newItem)
      setData('finance', data)
      renderTable()
      form.reset()
      receiptNameEl.textContent = 'Файл не выбран'
    }
  })

  renderTable()
  return container
}

export const financePageContent: PageContent = {
  title: 'Финансы (чеки и командировки)',
  blocks: [
    {
      kind: 'custom',
      render: renderFinance,
    },
  ],
}
