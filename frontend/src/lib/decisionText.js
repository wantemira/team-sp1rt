const reasons = {
  AFFORDABLE_COUNTER_OFFER: 'Подготовили предложение с безопасной суммой.',
  EMPLOYEE_APPROVED_AFFORDABLE: 'Сотрудник одобрил условия с учётом денежного потока.',
  AFFORDABLE_REQUEST: 'Запрошенная сумма одобрена.',
  EXTERNAL_CHECK_UNAVAILABLE: 'Источник временно не ответил. Сотрудник повторит проверку.',
  EXTERNAL_DATA_INCOMPLETE: 'Нужна дополнительная проверка данных сотрудником.',
  INVALID_SOURCE_DATA: 'В данных источника есть расхождения. Передали заявку сотруднику.',
  MISSING_FINANCIAL_INFORMATION: 'Уточните финансовые показатели, чтобы продолжить рассмотрение.',
  NON_POSITIVE_CASH_FLOW: 'По полученным данным после операционных расходов не остаётся средств на кредитные платежи.',
  NO_AFFORDABLE_PRODUCT_AMOUNT: 'Доступный платёж не позволяет предложить минимальную сумму этого продукта.',
  BUSINESS_INACTIVE: 'По сведениям ФНС бизнес не имеет действующего статуса.',
  BUSINESS_TOO_YOUNG: 'Для этого продукта бизнес должен работать не менее года.',
  CURRENT_OVERDUE: 'В кредитной истории есть текущая просрочка.',
  SCORE_BELOW_APPROVAL_THRESHOLD: 'Оценка риска не позволяет предложить этот кредит.',
  SCORE_REQUIRES_MANUAL_REVIEW: 'Заявку рассматривает сотрудник банка.',
  MISSING_FINANCIALS: 'Уточните запрошенные финансовые показатели.',
  EMPLOYEE_RISK_DECLINED: 'Сотрудник отказал после проверки данных заявки.',
}
export const decisionText = code => reasons[code] || 'Результат рассмотрения сохранён в заявке.'

const events = {
  'Draft created.': 'Черновик сохранён.',
  'Application submitted for review.': 'Заявка отправлена на рассмотрение.',
  'Client provided requested financial information.': 'Дополнительные сведения получены.',
  'Employee retried unavailable external checks.': 'Сотрудник повторил внешние проверки.',
  'Demo credit agreement signed and funds issued.': 'Согласие с условиями принято; выдача смоделирована.',
  'Provide the requested financial information.': 'Заполните запрошенные финансовые показатели.',
}
export const commentText = (comment, fallback = 'Комментарий к заявке сохранён.') => events[comment] || reasons[comment] || (
  typeof comment === 'string' && /[а-яё]/i.test(comment) && !/\b(?:APPROVE|REJECT|REQUEST_INFO|NEEDS_INFO|cash-flow-demo)\b/.test(comment) ? comment : fallback
)
export const historyText = comment => commentText(comment, 'Изменение заявки сохранено.')
