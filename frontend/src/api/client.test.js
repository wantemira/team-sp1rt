import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError, createApiClient, getFieldErrors } from './client.js'
import { createCreditApi } from './creditApi.js'
test('request preserves ruble strings, version, and bearer token', async () => {
  const original = globalThis.fetch
  let captured
  globalThis.fetch = async (url, options) => {
    captured = { url, ...options }
    return new Response(JSON.stringify({ id: 1 }), { status: 200 })
  }
  try {
    const api = createCreditApi({ getToken: () => 'test-token' })
    await api.applications.update(1, { requested_amount: '1500000.50' }, 7)
    assert.equal(captured.url, '/api/v1/applications/1')
    assert.equal(captured.headers.Authorization, 'Bearer test-token')
    assert.deepEqual(JSON.parse(captured.body), { requested_amount: '1500000.50', version: 7 })
  } finally { globalThis.fetch = original }
})
test('unauthorized and validation errors retain server details', async () => {
  const original = globalThis.fetch
  let unauthorized = false
  globalThis.fetch = async () => new Response(JSON.stringify({ error_code: 'UNAUTHORIZED', message: 'Войдите снова' }), { status: 401 })
  try {
    const request = createApiClient({ onUnauthorized: () => { unauthorized = true } })
    await assert.rejects(request('/auth/me'), error => error instanceof ApiError && error.status === 401 && error.message === 'Войдите снова')
    assert.equal(unauthorized, true)
    assert.deepEqual(getFieldErrors({ details: { fields: [{ field: 'body.requested_amount', message: 'Ошибка суммы' }] } }), { requested_amount: 'Ошибка суммы' })
  } finally { globalThis.fetch = original }
})
