/** API money is a decimal string in rubles, not kopecks. */
export function normalizeMoneyInput(value) {
  if (value == null) return null
  const raw = String(value).replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null
  const [integer, fraction = ''] = raw.split('.')
  return `${BigInt(integer)}.${fraction.padEnd(2, '0')}`
}
export function formatMoney(value) {
  const normalized = normalizeMoneyInput(value)
  if (normalized === null) return '—'
  const [integer, fraction] = normalized.split('.')
  const grouped = new Intl.NumberFormat('ru-RU').format(BigInt(integer))
  return `${grouped}${fraction === '00' ? '' : `,${fraction}`} ₽`
}
export function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(date)
}
export function formatRate(value) {
  if (value == null || value === '') return '—'
  const [whole, decimals = ''] = String(value).split('.')
  const fraction = decimals.replace(/0+$/, '')
  return `${whole}${fraction ? ',' + fraction : ''}% годовых`
}
