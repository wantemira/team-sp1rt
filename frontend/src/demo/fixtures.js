// Synthetic component examples, never imported by the API adapter.
const history = [
  { id: 1, new_status: 'DRAFT', comment: 'Черновик сохранен', created_at: '2026-10-24T05:00:00Z' },
  { id: 2, new_status: 'CHECKING', comment: 'Заявка отправлена', created_at: '2026-10-24T05:05:00Z' },
]
export const demoApplications = [
  { id: 1042, product_type: 'term_loan', requested_amount: '1500000.00', requested_term_months: 12, status: 'NEEDS_INFO', version: 3, created_at: '2026-10-24T05:00:00Z', next_actions: ['FILL'], missing_fields: ['business_data.financials.annual_revenue'], info_comment: 'Уточните выручку за последние 12 месяцев', status_history: [...history, { id: 3, new_status: 'NEEDS_INFO', comment: 'Нужны сведения о выручке' }] },
  { id: 1041, product_type: 'term_loan', requested_amount: '1000000.00', requested_term_months: 12, approved_amount: '800000.00', approved_rate: '28.00', status: 'APPROVED', version: 5, created_at: '2026-10-23T05:00:00Z', next_actions: ['SIGN'], status_history: [...history, { id: 3, new_status: 'APPROVED', comment: 'Предложение готово' }] },
]
export const demoQueue = [
  { id: 1043, company_name: 'ООО Вектор', client: { inn: '7700000002' }, requested_amount: '1500000.00', requested_term_months: 12, score: 45, risk_grade: 'D', status: 'MANUAL_REVIEW', version: 3, decision_reason_code: 'BORDERLINE_RISK', created_at: '2026-10-24T05:00:00Z', next_actions: ['APPROVE', 'REQUEST_INFO', 'REJECT'], checks: [{ id: 1, check_type: 'FNS', status: 'SUCCESS' }, { id: 2, check_type: 'BKI', status: 'SUCCESS' }], scoring_result: { rules_version: 'demo-v1', factors: [{ code: 'AGE', label: 'Возраст бизнеса', points: 5, explanation: 'Меньше 12 месяцев' }, { code: 'HISTORY', label: 'Платежная дисциплина', points: 10, explanation: 'Просрочка 1–29 дней' }, { code: 'MARGIN', label: 'Маржа', points: 5, explanation: 'Положительная, ниже 10%' }, { code: 'COVERAGE', label: 'Покрытие платежей', points: 25, explanation: 'От 2' }] }, status_history: [...history, { id: 3, new_status: 'MANUAL_REVIEW', comment: 'Пограничная оценка риска' }] },
  { id: 1044, company_name: 'ООО АльфаТех', client: { inn: '7700000003' }, requested_amount: '2000000.00', requested_term_months: 24, score: null, risk_grade: null, status: 'MANUAL_REVIEW', version: 3, decision_reason_code: 'EXTERNAL_CHECK_UNAVAILABLE', created_at: '2026-10-24T05:00:00Z', next_actions: ['RETRY_CHECKS'], checks: [{ id: 3, check_type: 'FNS', status: 'TIMEOUT' }, { id: 4, check_type: 'BKI', status: 'SUCCESS' }], status_history: [...history, { id: 3, new_status: 'MANUAL_REVIEW', comment: 'ФНС не ответила' }] },
]
export const demoNews = [
  { id: 'trade', title: 'Как подготовиться к сезонной закупке', excerpt: 'Короткий чек-лист для торговой компании', body: 'Оцените потребность в оборотных средствах, сроки поставки и запас на складе.\nДемонстрационный материал, созданный для прототипа.' },
  { id: 'cash', title: 'Денежный поток: на что обратить внимание', excerpt: 'Выручка и свободные средства — разные показатели', body: 'При планировании кредита учитывайте расходы и существующие обязательства.\nДемонстрационный материал, созданный для прототипа.' },
]
export const initialForm = { requested_amount: '1500000.00', requested_term_months: '12', purpose: 'Пополнение оборотных средств', annual_revenue: '', annual_expenses: '' }
