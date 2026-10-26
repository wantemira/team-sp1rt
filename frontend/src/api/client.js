const translations = {
  'Invalid email or password.': 'Неверный email или пароль.',
  'Requested approval does not satisfy the credit policy and DSCR 1.35.': 'Сумма не соответствует кредитной политике и безопасному покрытию платежей (DSCR 1,35). Укажите меньшую сумму.',
  'The interest rate is calculated by the server.': 'Ставку рассчитывает сервер. Обновите условия предложения.',
  'Uploaded file is empty.': 'Выбранный файл пуст. Загрузите документ с содержимым.',
  'Stored document file not found.': 'Файл документа не найден на сервере.',
  'Field required': 'Заполните поле',
}
function readableMessage(message, fallback) {
  return translations[message] || (typeof message === 'string' && /[а-яё]/i.test(message) ? message : fallback)
}
const statusMessages = {
  400: 'Не удалось выполнить действие. Проверьте введённые данные.',
  401: 'Сессия завершена. Войдите в кабинет снова.',
  403: 'У вас нет доступа к этому действию.',
  404: 'Запрашиваемые данные не найдены или недоступны.',
  409: 'Заявка изменилась. Обновите данные перед следующим действием.',
  413: 'Файл превышает допустимый размер. Выберите файл меньшего размера.',
  422: 'Проверьте заполненные поля и допустимость выбранного действия.',
  429: 'Слишком много запросов. Повторите попытку немного позже.',
}
export class ApiError extends Error {
  constructor(status, payload) {
    super(readableMessage(payload?.message, statusMessages[status] || (status >= 500 ? 'Сервер временно недоступен. Повторите загрузку позже.' : 'Не удалось выполнить запрос.')))
    this.name = 'ApiError'
    this.status = status
    this.code = payload?.error_code
    this.details = payload?.details
  }
}
/** No implicit token storage and no requests on import. Supply getToken from auth. */
export function createApiClient({ baseUrl = '/api/v1', getToken = () => null, onUnauthorized = () => {} } = {}) {
  return async function request(path, { method = 'GET', body, signal, responseType = 'json' } = {}) {
    const token = getToken()
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData
    const headers = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
    let response
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
        method, headers, signal, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      })
    } catch (error) {
      if (signal?.aborted || error.name === 'AbortError') throw error
      throw new ApiError(0, { error_code: 'NETWORK_ERROR', message: 'Не удалось связаться с сервером. Проверьте подключение и обновите страницу.' })
    }
    if (response.ok && responseType === 'blob') return response.blob()
    let payload = null
    if (response.status !== 204) {
      try { payload = await response.json() }
      catch (error) {
        if (signal?.aborted || error.name === 'AbortError') throw error
        if (response.ok) throw new ApiError(response.status, { error_code: 'INVALID_RESPONSE', message: 'Сервер вернул некорректный ответ. Обновите данные перед следующим действием.' })
      }
    }
    if (!response.ok) {
      if (response.status === 401) onUnauthorized()
      throw new ApiError(response.status, payload)
    }
    return payload
  }
}
export function getFieldErrors(error) {
  const fields = error?.details?.fields
  return Object.fromEntries((Array.isArray(fields) ? fields : []).filter(field => typeof field?.field === 'string').map(field => [
    field.field.replace(/^body\./, ''), readableMessage(field.message, 'Проверьте значение поля'),
  ]))
}
