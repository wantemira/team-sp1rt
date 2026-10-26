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

test('network failure is readable while aborts keep cancellation semantics', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
    await assert.rejects(createApiClient()('/applications'), error => error.code === 'NETWORK_ERROR' && error.status === 0 && error.message.includes('Проверьте подключение'))
    const abort = new DOMException('Cancelled', 'AbortError')
    globalThis.fetch = async () => { throw abort }
    await assert.rejects(createApiClient()('/applications'), error => error === abort)
  } finally { globalThis.fetch = original }
})

test('broken successful response is not treated as a completed operation; non-JSON errors retain status', async () => {
  const original = globalThis.fetch
  let unauthorized = false
  const request = createApiClient({ onUnauthorized: () => { unauthorized = true } })
  try {
    globalThis.fetch = async () => new Response('<html>gateway error</html>')
    await assert.rejects(request('/applications'), error => error.code === 'INVALID_RESPONSE')
    globalThis.fetch = async () => new Response('<html>unauthorized</html>', { status: 401 })
    await assert.rejects(request('/auth/me'), error => error.status === 401 && /Войдите/.test(error.message))
    assert.equal(unauthorized, true)
    globalThis.fetch = async () => new Response('<html>gateway unavailable</html>', { status: 502 })
    await assert.rejects(request('/products'), error => error.status === 502 && /временно недоступен/.test(error.message))
  } finally { globalThis.fetch = original }
})

test('server policy messages are translated without losing technical code and field details', () => {
  const details = { fields: [{ field: 'body.requested_amount', message: 'Field required' }] }
  const error = new ApiError(422, { message: 'Requested approval does not satisfy the credit policy and DSCR 1.35.', error_code: 'REQUEST_ERROR', details })
  assert.match(error.message, /DSCR 1,35/)
  assert.equal(error.code, 'REQUEST_ERROR')
  assert.equal(error.details, details)
  assert.deepEqual(getFieldErrors(error), { requested_amount: 'Заполните поле' })
  assert.equal(new ApiError(401, { message: 'Invalid email or password.' }).message, 'Неверный email или пароль.')
})
