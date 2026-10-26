import { groupChecks } from './checks.js'
import { formatMoney, normalizeMoneyInput } from './format.js'

const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null
const money = value => typeof value === 'string' ? normalizeMoneyInput(value) : null

function monthlyFlow(revenue, expenses) {
  if (revenue === null || expenses === null) return null
  const difference = BigInt(revenue.replace('.', '')) - BigInt(expenses.replace('.', ''))
  // Представление (выручка − расходы) / 12, с округлением до копейки.
  const cents = ((difference < 0n ? -difference : difference) + 6n) / 12n
  const value = `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
  return `${difference < 0n && cents !== 0n ? '−' : ''}${formatMoney(value)}`
}

export function financialBasis(application) {
  const inputs = application.scoring_result?.inputs
  const latest = groupChecks(application.checks).current
  const source = type => {
    const check = latest.find(item => item.check_type === type)
    return check ? { ...check.response_data, status: check.status } : {}
  }
  // Не смешиваем сохранённый расчёт с обновлёнными полями заявки или прошлыми попытками.
  const fns = inputs ? inputs.fns || {} : source('FNS')
  const bki = inputs ? inputs.bki || {} : source('BKI')
  const financials = inputs ? inputs.financials || {} : application.business_data?.financials || {}
  const financial = (key, sourceKey) => {
    const fromFns = fns.status === 'SUCCESS' && fns[sourceKey] != null
    return { amount: money(fromFns ? fns[sourceKey] : financials[key]), source: fromFns ? 'ФНС' : 'Данные клиента' }
  }
  const revenue = financial('annual_revenue', 'annual_revenue')
  const expenses = financial('annual_expenses', 'annual_operating_expenses')
  const available = bki.status === 'SUCCESS'
  const total = available ? count(bki.total_payments_12m) : null
  const delayed = available ? count(bki.delayed_payments_12m) : null
  const history = total !== null && delayed !== null && delayed <= total ? { total, delayed } : null
  return {
    saved: Boolean(inputs), revenue, expenses,
    monthlyCashFlow: monthlyFlow(revenue.amount, expenses.amount),
    debtPayments: available ? money(bki.monthly_debt_payments) : null,
    activeLoans: available ? count(bki.active_loans_count) : null,
    overdueDays: available ? count(bki.current_overdue_days) : null,
    history,
    sourceProblem: ['EXTERNAL_CHECK_UNAVAILABLE', 'EXTERNAL_DATA_INCOMPLETE', 'INVALID_SOURCE_DATA'].includes(application.decision_reason_code),
  }
}
