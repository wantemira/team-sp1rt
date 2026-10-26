// Параметры примеров UI-kit; рабочие формы загружают ограничения из /products.
export const PRODUCT = Object.freeze({
  product_type: 'term_loan', name: 'Кредит на оборотные средства',
  min_amount: '100000.00', max_amount: '5000000.00', terms: [6, 12, 24],
})
export const APPLICATION_STATUSES = Object.freeze({
  DRAFT: { label: 'Черновик', tone: 'neutral' },
  CHECKING: { label: 'Проверка', tone: 'warning' },
  NEEDS_INFO: { label: 'Нужны сведения', tone: 'warning' },
  MANUAL_REVIEW: { label: 'Рассмотрение сотрудником', tone: 'warning' },
  APPROVED: { label: 'Одобрено', tone: 'success' },
  REJECTED: { label: 'Отказ', tone: 'danger' },
  ISSUED: { label: 'Выдача смоделирована', tone: 'success' },
})
export const ACTIONS = Object.freeze({
  EDIT: { label: 'Редактировать', variant: 'secondary' },
  SUBMIT: { label: 'Отправить заявку', variant: 'primary' },
  FILL: { label: 'Дополнить заявку', variant: 'primary' },
  SIGN: { label: 'Подписать и получить', variant: 'primary' },
  APPROVE: { label: 'Одобрить', variant: 'primary' },
  REJECT: { label: 'Отказать', variant: 'secondary' },
  REQUEST_INFO: { label: 'Запросить сведения', variant: 'secondary' },
  RETRY_CHECKS: { label: 'Повторить проверки', variant: 'primary' },
})
export const FINANCIAL_FIELDS = Object.freeze({
  'business_data.financials.annual_revenue': 'Выручка за последние 12 месяцев',
  'business_data.financials.annual_expenses': 'Расходы за последние 12 месяцев',
})
