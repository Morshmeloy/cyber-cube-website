import type { PageContent } from '../../../../types/page-content.ts'

interface WarehouseItem {
  id: number
  name: string
  quantity: number
  type: 'in' | 'out'
  date: string
  person: string
}

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

function renderWarehouse(): HTMLElement {
  const container = document.createElement('div')
  container.className = 'warehouse-container'

  const form = document.createElement('form')
  form.className = 'warehouse-form'
  form.innerHTML = `
    <h3>Добавить запись</h3>
    <div class="form-group">
      <label>Товар</label>
      <input type="text" id="warehouse-name" placeholder="Наименование" required>
    </div>
    <div class="form-group">
      <label>Количество</label>
      <input type="number" id="warehouse-quantity" min="1" required>
    </div>
    <div class="form-group">
      <label>Тип</label>
      <select id="warehouse-type">
        <option value="in">Прибытие</option>
        <option value="out">Отбытие</option>
      </select>
    </div>
    <div class="form-group">
      <label>Кто взял/вернул</label>
      <input type="text" id="warehouse-person" placeholder="ФИО" required>
    </div>
    <button type="submit" class="btn-primary">Добавить</button>
  `
  container.appendChild(form)

  const tableWrapper = document.createElement('div')
  tableWrapper.className = 'warehouse-table-wrapper'
  tableWrapper.innerHTML = `
    <h3>История операций</h3>
    <table class="warehouse-table">
      <thead><tr><th>#</th><th>Товар</th><th>Кол-во</th><th>Тип</th><th>Дата</th><th>Кто</th></tr></thead>
      <tbody id="warehouse-tbody"></tbody>
    </table>
    <h3>Остатки по товарам</h3>
    <table class="warehouse-table">
      <thead><tr><th>Товар</th><th>Остаток</th></tr></thead>
      <tbody id="warehouse-summary-tbody"></tbody>
    </table>
  `
  container.appendChild(tableWrapper)

  const nameInput = form.querySelector<HTMLInputElement>('#warehouse-name')!
  const quantityInput = form.querySelector<HTMLInputElement>('#warehouse-quantity')!
  const typeSelect = form.querySelector<HTMLSelectElement>('#warehouse-type')!
  const personInput = form.querySelector<HTMLInputElement>('#warehouse-person')!
  const tbody = tableWrapper.querySelector('#warehouse-tbody')!
  const summaryTbody = tableWrapper.querySelector('#warehouse-summary-tbody')!

  function renderTables(): void {
    const items = getItems()
    tbody.innerHTML = items
      .map(
        (item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>${item.type === 'in' ? '📥 Прибытие' : '📤 Отбытие'}</td>
        <td>${item.date}</td>
        <td>${item.person}</td>
      </tr>
    `,
      )
      .join('')

    const summary: Record<string, number> = {}
    for (const item of items) {
      const delta = item.type === 'in' ? item.quantity : -item.quantity
      summary[item.name] = (summary[item.name] ?? 0) + delta
    }
    summaryTbody.innerHTML = Object.entries(summary)
      .filter(([, qty]) => qty !== 0)
      .map(([name, qty]) => `<tr><td>${name}</td><td>${qty}</td></tr>`)
      .join('')
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const name = nameInput.value.trim()
    const quantity = parseInt(quantityInput.value, 10)
    const type = typeSelect.value as 'in' | 'out'
    const person = personInput.value.trim()
    if (!name || !quantity || !person) return

    const items = getItems()
    items.push({ id: Date.now(), name, quantity, type, date: new Date().toLocaleString(), person })
    setItems(items)
    renderTables()
    form.reset()
  })

  renderTables()
  return container
}

export const warehousePageContent: PageContent = {
  title: 'Складской учёт',
  blocks: [
    {
      kind: 'custom',
      render: renderWarehouse,
    },
  ],
}
