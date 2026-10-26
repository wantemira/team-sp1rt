import assert from 'node:assert/strict'
import test from 'node:test'
import { commentText, decisionText, historyText } from './decisionText.js'
import { riskText, riskHint, factorText, factorExplanation, documentText, checkTypeText, profileName } from './displayText.js'

test('Старые системные сообщения и неизвестные коды получают русское пояснение', () => {
  assert.equal(commentText('Provide the requested financial information.'), 'Заполните запрошенные финансовые показатели.')
  assert.equal(historyText('Draft created.'), 'Черновик сохранён.')
  assert.equal(historyText('FUTURE_INTERNAL_REASON'), 'Изменение заявки сохранено.')
  assert.equal(historyText('Уточните выручку за год.'), 'Уточните выручку за год.')
  assert.equal(decisionText('MISSING_FINANCIALS'), 'Уточните запрошенные финансовые показатели.')
})

test('Риск, факторы и документы не раскрывают технические идентификаторы', () => {
  assert.equal(riskText('C'), 'Повышенный')
  assert.equal(riskText(null), 'Не определён')
  assert.match(riskHint(null), /получения необходимых данных/)
  assert.equal(factorText({ code: 'DSCR', label: 'DSCR factor' }), 'Покрытие долговых платежей')
  assert.equal(factorText({ code: 'FUTURE', label: 'Unknown factor' }), 'Дополнительный фактор оценки')
  assert.equal(factorExplanation('Internal explanation'), '')
  assert.equal(documentText('financial_report'), 'Финансовый отчёт')
  assert.equal(documentText('future_document'), 'Документ по заявке')
  assert.equal(checkTypeText('FUTURE_SOURCE'), 'Проверка сведений')
})

test('Имена старых тестовых профилей понятны без изменения реальных названий', () => {
  assert.equal(profileName('Test Client 1'), 'Тестовая компания 1')
  assert.equal(profileName('Test Employee 2'), 'Сотрудник банка 2')
  assert.equal(profileName('ИП Мария Ручное рассмотрение'), 'ИП Мария Ручное рассмотрение')
  assert.equal(profileName('Company Actual Name'), 'Company Actual Name')
})
