import { createApiClient } from './client.js'
export function createCreditApi(options) {
  const request = createApiClient(options)
  return {
    login: (credentials, signal) => request('/auth/login', { method: 'POST', body: credentials, signal }),
    me: signal => request('/auth/me', { signal }),
    products: signal => request('/products', { signal }),
    news: signal => request('/news', { signal }),
    applications: {
      list: signal => request('/applications', { signal }),
      get: (id, signal) => request(`/applications/${id}`, { signal }),
      create: (data, signal) => request('/applications', { method: 'POST', body: data, signal }),
      update: (id, data, version, signal) => request(`/applications/${id}`, { method: 'PATCH', body: { ...data, version }, signal }),
      submit: (id, version, signal) => request(`/applications/${id}/submit`, { method: 'POST', body: { version }, signal }),
      fill: (id, businessData, version, signal) => request(`/applications/${id}/fill`, { method: 'PATCH', body: { business_data: businessData, version }, signal }),
      sign: (id, version, signal) => request(`/applications/${id}/sign`, { method: 'POST', body: { version }, signal }),
    },
    employee: {
      list: (status = 'MANUAL_REVIEW', signal) => request(`/employee/applications?status=${encodeURIComponent(status)}`, { signal }),
      get: (id, signal) => request(`/employee/applications/${id}`, { signal }),
      action: (id, data, signal) => request(`/employee/applications/${id}/action`, { method: 'POST', body: data, signal }),
      retryChecks: (id, version, signal) => request(`/employee/applications/${id}/retry-checks`, { method: 'POST', body: { version }, signal }),
    },
  }
}
