import { formatMoney, normalizeMoneyInput } from './format.js'

const cents = value => BigInt(normalizeMoneyInput(value).replace('.', ''))

export function readProducts(data) {
  if (!Array.isArray(data)) throw new Error('Не удалось прочитать условия кредитного продукта.')
  return data.filter(item => item?.id === 'term_loan').map(item => {
    const min = normalizeMoneyInput(item.min_amount)
    const max = normalizeMoneyInput(item.max_amount)
    if (typeof item.name !== 'string' || !item.name.trim() || typeof item.min_amount !== 'string' || typeof item.max_amount !== 'string' || !min || !max || cents(min) <= 0n || cents(max) < cents(min) ||
      !Array.isArray(item.terms) || !item.terms.length || item.terms.some(term => !Number.isSafeInteger(term) || term <= 0)) {
      throw new Error('Сервер вернул неполные условия кредита. Обновите страницу или попробуйте позже.')
    }
    return { ...item, min_amount: min, max_amount: max, terms: [...new Set(item.terms)].sort((a, b) => a - b) }
  })
}

export function validateLoan(values, product, submitting) {
  const errors = {}
  const amount = normalizeMoneyInput(values.requested_amount)
  if ((submitting || values.requested_amount.trim()) && (!amount || cents(amount) < cents(product.min_amount) || cents(amount) > cents(product.max_amount))) {
    errors.requested_amount = `Укажите сумму от ${formatMoney(product.min_amount)} до ${formatMoney(product.max_amount)}, не более двух знаков после запятой`
  }
  if (!product.terms.includes(Number(values.requested_term_months))) errors.requested_term_months = 'Выберите доступный срок кредита'
  return errors
}
