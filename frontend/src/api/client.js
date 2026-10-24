export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.message || 'Не удалось выполнить запрос')
    this.name = 'ApiError'
    this.status = status
    this.code = payload?.error_code
    this.details = payload?.details
  }
}
/** No implicit token storage and no requests on import. Supply getToken from auth. */
export function createApiClient({ baseUrl = '/api/v1', getToken = () => null, onUnauthorized = () => {} } = {}) {
  return async function request(path, { method = 'GET', body, signal } = {}) {
    const token = getToken()
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData
    const headers = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      method, headers, signal, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
    const payload = response.status === 204 ? null : await response.json().catch(() => null)
    if (!response.ok) {
      if (response.status === 401) onUnauthorized()
      throw new ApiError(response.status, payload)
    }
    return payload
  }
}
export function getFieldErrors(error) {
  return Object.fromEntries((error?.details?.fields || []).map(field => [
    field.field.replace(/^body\./, ''), field.message,
  ]))
}
