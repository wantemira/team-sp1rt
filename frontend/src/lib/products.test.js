import { test } from 'node:test'
import assert from 'node:assert/strict'
import { approvalError, readProducts, validateLoan } from './products.js'

const product = { id: 'term_loan', name: 'Оборотный кредит', min_amount: '250000.00', max_amount: '2000000.50', terms: [12, 24] }
test('limits and terms come from the product, including exact ruble boundaries', () => {
  assert.deepEqual(validateLoan({ requested_amount: '250000', requested_term_months: '12' }, product, true), {})
  assert.deepEqual(validateLoan({ requested_amount: '2000000,50', requested_term_months: '24' }, product, true), {})
  assert.ok(validateLoan({ requested_amount: '249999.99', requested_term_months: '6' }, product, true).requested_term_months)
  assert.ok(validateLoan({ requested_amount: '249999.99', requested_term_months: '12' }, product, true).requested_amount)
  assert.ok(validateLoan({ requested_amount: '2000000.51', requested_term_months: '12' }, product, true).requested_amount)
  assert.deepEqual(validateLoan({ requested_amount: '', requested_term_months: '12' }, product, false), {})
  assert.ok(validateLoan({ requested_amount: '', requested_term_months: '12' }, product, true).requested_amount)
})
test('incomplete product responses cannot enable an application with invented limits', () => {
  assert.throws(() => readProducts({ products: [] }))
  assert.throws(() => readProducts([{ ...product, terms: [] }]))
  assert.throws(() => readProducts([{ ...product, min_amount: 'NaN' }]))
  assert.throws(() => readProducts([{ ...product, max_amount: '1' }]))
  assert.deepEqual(readProducts([]), [])
  assert.deepEqual(readProducts([{ ...product, terms: [24, 12, 24] }])[0].terms, [12, 24])
})

test('manual approval respects both the requested amount and current product limits to the kopeck', () => {
  assert.equal(approvalError('250000', '1000000.00', product), '')
  assert.equal(approvalError('1000000.01', '1000000.01', product), '')
  assert.ok(approvalError('1000000.02', '1000000.01', product))
  assert.ok(approvalError('249999.99', '1000000.00', product))
  assert.ok(approvalError('2000000.51', '3000000.00', product))
})
