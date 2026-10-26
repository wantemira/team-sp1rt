import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupChecks } from './checks.js'

test('a successful retry replaces the old timeout even in an unordered response', () => {
  const checks = [{ id: 5, check_type: 'FNS', status: 'SUCCESS' }, { id: 2, check_type: 'BKI', status: 'SUCCESS' }, { id: 1, check_type: 'FNS', status: 'TIMEOUT' }, { id: 6, check_type: 'BKI', status: 'ERROR' }]
  const result = groupChecks(checks)
  assert.deepEqual(result.current.map(check => check.id), [5, 6])
  assert.deepEqual(result.previous.map(check => check.id), [2, 1])
  assert.deepEqual(groupChecks([]), { current: [], previous: [] })
})
