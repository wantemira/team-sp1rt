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
      fill: (id, businessData, version, signal) => request(`/applications/${id}/fill`, { method: 'POST', body: { business_data: businessData, version }, signal }),
      sign: (id, version, signal) => request(`/applications/${id}/sign`, { method: 'POST', body: { version }, signal }),
    },
    documents: {
      upload: (applicationId, formData, signal) => request(`/applications/${applicationId}/documents`, { method: 'POST', body: formData, signal }),
      download: (applicationId, documentId, signal) => request(`/applications/${applicationId}/documents/${documentId}/file`, { responseType: 'blob', signal }),
    },
    employee: {
      list: (status = 'MANUAL_REVIEW', signal) => request(`/employee/applications?status=${encodeURIComponent(status)}`, { signal }),
      queue: async (filter = 'QUEUE', signal) => {
        const statuses = { QUEUE: ['MANUAL_REVIEW'], REVIEW: ['CHECKING', 'NEEDS_INFO'], HISTORY: ['APPROVED', 'REJECTED', 'ISSUED'] }[filter]
        if (!statuses) throw new Error('Неизвестный фильтр очереди')
        const lists = await Promise.all(statuses.map(status => request(`/employee/applications?status=${status}`, { signal })))
        return [...new Map(lists.flat().map(item => [item.id, item])).values()]
      },
      get: (id, signal) => request(`/employee/applications/${id}`, { signal }),
      action: (id, data, signal) => request(`/employee/applications/${id}/action`, { method: 'POST', body: data, signal }),
      retryChecks: (id, version, signal) => request(`/employee/applications/${id}/retry-checks`, { method: 'POST', body: { version }, signal }),
    },
  }
}
