const reasons = {
  AFFORDABLE_COUNTER_OFFER: 'Подготовили предложение с безопасной суммой.',
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
}
export const decisionText = code => reasons[code] || 'Результат рассмотрения сохранён в заявке.'

const events = {
  'Draft created.': 'Черновик сохранён.',
  'Application submitted for review.': 'Заявка отправлена на рассмотрение.',
  'Client provided requested financial information.': 'Дополнительные сведения получены.',
  'Employee retried unavailable external checks.': 'Сотрудник повторил внешние проверки.',
  'Demo credit agreement signed and funds issued.': 'Согласие с условиями принято; выдача смоделирована.',
}
export const historyText = comment => events[comment] || reasons[comment] || comment
