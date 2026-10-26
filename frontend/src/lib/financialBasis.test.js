import assert from 'node:assert/strict'
import test from 'node:test'
import { financialBasis } from './financialBasis.js'

const snapshot = () => ({
  scoring_result: { inputs: {
    fns: { status: 'SUCCESS', annual_revenue: '2400000.00', annual_operating_expenses: '1200000.00' },
    bki: { status: 'SUCCESS', monthly_debt_payments: '0.00', active_loans_count: 0, total_payments_12m: 24, delayed_payments_12m: 6, current_overdue_days: 0 },
    financials: { annual_revenue: '999999999.00', annual_expenses: '0.00' },
  } },
  business_data: { financials: { annual_revenue: '999999999.00', annual_expenses: '0.00' } },
})

test('manual review uses saved source inputs and keeps zero debt distinct from missing debt', () => {
  const result = financialBasis(snapshot())
  assert.equal(result.revenue.amount, '2400000.00')
  assert.equal(result.revenue.source, 'ФНС')
  assert.equal(result.monthlyCashFlow, '100\u00a0000 ₽')
  assert.equal(result.debtPayments, '0.00')
  assert.equal(result.activeLoans, 0)
  assert.equal(result.overdueDays, 0)
  assert.deepEqual(result.history, { total: 24, delayed: 6 })
})

test('client financials are used only when the saved source lacks the value', () => {
  const application = snapshot()
  application.scoring_result.inputs.fns.annual_revenue = null
  const result = financialBasis(application)
  assert.equal(result.revenue.source, 'Данные клиента')
  assert.equal(result.revenue.amount, '999999999.00')
  application.scoring_result.inputs.fns.annual_revenue = 'NaN'
  assert.equal(financialBasis(application).revenue.amount, null)
  assert.equal(financialBasis(application).monthlyCashFlow, null)
})

test('a failed latest attempt never falls back to an earlier successful BKI response', () => {
  const application = { decision_reason_code: 'EXTERNAL_CHECK_UNAVAILABLE', checks: [
    { id: 4, check_type: 'BKI', status: 'TIMEOUT', response_data: { monthly_debt_payments: '0.00', total_payments_12m: 0, delayed_payments_12m: 0, current_overdue_days: 0 } },
    { id: 1, check_type: 'BKI', status: 'SUCCESS', response_data: { monthly_debt_payments: '50000.00', total_payments_12m: 24, delayed_payments_12m: 0, current_overdue_days: 0 } },
  ] }
  const result = financialBasis(application)
  assert.equal(result.debtPayments, null)
  assert.equal(result.history, null)
  assert.equal(result.overdueDays, null)
  assert.equal(result.sourceProblem, true)
})

test('missing snapshot fields cannot be replaced with current application or check data', () => {
  const application = snapshot()
  application.scoring_result.inputs = { fns: { status: 'SUCCESS' } }
  application.checks = [{ id: 1, check_type: 'BKI', status: 'SUCCESS', response_data: { monthly_debt_payments: '0.00' } }]
  const result = financialBasis(application)
  assert.equal(result.revenue.amount, null)
  assert.equal(result.debtPayments, null)
})

test('monthly flow preserves large ruble values, cents, a loss and a true zero', () => {
  const application = snapshot()
  const fns = application.scoring_result.inputs.fns
  fns.annual_revenue = '9999999999999999.99'
  fns.annual_operating_expenses = '9999999999999999.93'
  assert.equal(financialBasis(application).monthlyCashFlow, '0,01 ₽')
  fns.annual_revenue = '0.00'
  fns.annual_operating_expenses = '1200000.00'
  assert.equal(financialBasis(application).monthlyCashFlow, '−100\u00a0000 ₽')
  fns.annual_operating_expenses = '0.00'
  assert.equal(financialBasis(application).monthlyCashFlow, '0 ₽')
})

test('no credit history differs from missing or inconsistent payment counts', () => {
  const application = snapshot()
  const bki = application.scoring_result.inputs.bki
  bki.total_payments_12m = 0; bki.delayed_payments_12m = 0
  assert.deepEqual(financialBasis(application).history, { total: 0, delayed: 0 })
  bki.total_payments_12m = null
  assert.equal(financialBasis(application).history, null)
  bki.total_payments_12m = 2; bki.delayed_payments_12m = 3
  assert.equal(financialBasis(application).history, null)
  bki.current_overdue_days = false
  assert.equal(financialBasis(application).overdueDays, null)
})
