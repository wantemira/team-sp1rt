import assert from 'node:assert/strict'
import test from 'node:test'
import { formatMoney, formatRate, normalizeMoneyInput } from './format.js'
test('money normalization preserves rubles and two decimal places', () => {
  assert.equal(normalizeMoneyInput('1 500 000,50'), '1500000.50')
  assert.equal(normalizeMoneyInput('0'), '0.00')
  assert.equal(normalizeMoneyInput('9007199254740993.01'), '9007199254740993.01')
  for (const value of ['', '-1', '1.234', '1e6', 'NaN', null]) assert.equal(normalizeMoneyInput(value), null)
})
test('display does not lose cents or display missing money as zero', () => {
  assert.equal(formatMoney(null), '—')
  assert.equal(formatMoney('1500000.50').replace(/\s/g, ''), '1500000,50₽')
  assert.equal(formatMoney('9007199254740993.01').replace(/\s/g, ''), '9007199254740993,01₽')
  assert.equal(formatRate('20.00'), '20% годовых')
  assert.equal(formatRate('0'), '0% годовых')
})
