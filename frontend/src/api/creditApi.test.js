import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createCreditApi } from './creditApi.js'

test('credit actions send JSON versions and canonical fill method', async () => {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    calls.push({ url, ...init })
    return new Response('{}', { status: 200 })
  }
  try {
    const api = createCreditApi({ getToken: () => 'session' })
    await api.applications.submit(3, 2)
    await api.applications.sign(3, 3)
    await api.applications.fill(3, { financials: { annual_revenue: '5000000.00' } }, 4)
    await api.employee.retryChecks(3, 5)
    assert.deepEqual(calls.map(call => call.method), ['POST', 'POST', 'POST', 'POST'])
    assert.deepEqual(calls.map(call => JSON.parse(call.body).version), [2, 3, 4, 5])
    assert.equal(JSON.parse(calls[2].body).business_data.financials.annual_revenue, '5000000.00')
    assert.ok(calls.every(call => call.headers.Authorization === 'Bearer session'))
  } finally { globalThis.fetch = original }
})

test('employee history expands server statuses and downloads keep the token', async () => {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    calls.push({ url, ...init })
    return url.endsWith('/file') ? new Response('file contents') : new Response('[{"id":1}]')
  }
  try {
    const api = createCreditApi({ getToken: () => 'session' })
    assert.deepEqual(await api.employee.queue('HISTORY'), [{ id: 1 }])
    assert.deepEqual(calls.map(call => call.url), [
      '/api/v1/employee/applications?status=APPROVED',
      '/api/v1/employee/applications?status=REJECTED',
      '/api/v1/employee/applications?status=ISSUED',
    ])
    assert.equal(await (await api.documents.download(2, 4)).text(), 'file contents')
    assert.equal(calls[3].headers.Authorization, 'Bearer session')
  } finally { globalThis.fetch = original }
})
