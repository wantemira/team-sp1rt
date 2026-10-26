const riskLevels = { A: 'Низкий', B: 'Умеренный', C: 'Повышенный', D: 'Высокий' }
export const riskText = grade => riskLevels[grade] || 'Не определён'
export const riskHint = score => score == null ? 'Оценка появится после получения необходимых данных' : 'По результатам оценки платёжеспособности'

const factorLabels = {
  AGE: 'Возраст бизнеса', DSCR: 'Покрытие долговых платежей', COVERAGE: 'Покрытие долговых платежей',
  DISCIPLINE: 'Кредитная дисциплина', HISTORY: 'Кредитная дисциплина', SIZE: 'Сумма относительно выручки',
  INDUSTRY: 'Отраслевой риск', MARGIN: 'Рентабельность',
}
export const factorText = factor => factorLabels[factor.code] || 'Дополнительный фактор оценки'
export const factorExplanation = explanation => typeof explanation === 'string' && /[а-яё]/i.test(explanation) ? explanation : ''
const documentTypes = { financial_report: 'Финансовый отчёт', charter: 'Учредительные документы', other: 'Другой документ' }
export const documentText = type => documentTypes[type] || (typeof type === 'string' && /[а-яё]/i.test(type) ? type : 'Документ по заявке')
export const checkTypeText = type => ({ FNS: 'Проверка компании · ФНС', BKI: 'Кредитная история · БКИ' }[type] || 'Проверка сведений')
export const profileName = name => typeof name === 'string' ? name.replace(/^Test Client ([123])$/, 'Тестовая компания $1').replace(/^Test Employee ([12])$/, 'Сотрудник банка $1') : name
