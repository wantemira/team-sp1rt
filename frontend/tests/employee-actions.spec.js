import { expect, test } from '@playwright/test'

// Контрактные сценарии UI: ответы ручного рассмотрения подменены,
// авторизация настоящая. Реальный повтор проверки покрыт employee-flow.spec.js.
const password = process.env.E2E_PASSWORD || 'password123'
const product = { id: 'term_loan', name: 'Оборотный кредит', min_amount: '250000.00', max_amount: '5000000.00', terms: [6, 12, 24] }
function application() {
  return {
    id: 900001, product_type: 'term_loan', company_name: 'ИП Проверка интерфейса',
    client: { id: 1, inn: '770000000001', company_name: 'ИП Проверка интерфейса', client_type: 'INDIVIDUAL' },
    requested_amount: '1000000.00', requested_term_months: 24, status: 'MANUAL_REVIEW', version: 3,
    next_actions: ['APPROVE', 'REJECT', 'REQUEST_INFO'], score: 60, risk_grade: 'C',
    decision_reason_code: 'SCORE_REQUIRES_MANUAL_REVIEW', missing_fields: [],
    checks: [{ id: 1, check_type: 'FNS', status: 'SUCCESS' }, { id: 2, check_type: 'BKI', status: 'SUCCESS' }, { id: 0, check_type: 'FNS', status: 'TIMEOUT' }],
    scoring_result: { rules_version: 'cash-flow-demo-v1', factors: [] }, status_history: [],
  }
}
async function setup(page, handler) {
  let current = application()
  let unavailable = false
  await page.route('**/api/v1/products', route => route.fulfill({ json: [product] }))
  await page.route('**/api/v1/employee/applications**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/action')) return handler(route, current, value => { current = value }, value => { unavailable = value })
    if (url.pathname.endsWith('/900001')) return unavailable
      ? route.fulfill({ status: 503, json: { message: 'Карточка временно недоступна' } })
      : route.fulfill({ json: current })
    return route.fulfill({ json: url.searchParams.get('status') === current.status ? [current] : [] })
  })
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill('test.employee1@example.com')
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Одобрить', exact: true })).toBeVisible()
  return { recover: () => { unavailable = false } }
}

for (const action of ['REQUEST_INFO', 'REJECT']) {
  test(`Ручное действие ${action}: валидация и отправка текущей версии`, async ({ page }) => {
    let captured
    await setup(page, (route, current, update) => {
      captured = route.request().postDataJSON()
      const result = { ...current, status: action === 'REJECT' ? 'REJECTED' : 'NEEDS_INFO', next_actions: [], version: 4 }
      update(result)
      return route.fulfill({ json: result })
    })
    const label = action === 'REJECT' ? 'Отказать' : 'Запросить сведения'
    await expect(page.getByRole('list', { name: 'Текущие результаты проверок' })).not.toContainText('Источник не ответил')
    await page.getByText('Предыдущие попытки (1)', { exact: true }).click()
    await expect(page.getByRole('list', { name: 'История попыток проверок' })).toContainText('Источник не ответил')
    await page.getByRole('button', { name: label, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: label, exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('Добавьте комментарий')
    await dialog.getByLabel('Комментарий', { exact: true }).fill('Проверены сведения клиента')
    await dialog.getByRole('button', { name: label, exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText(action === 'REJECT' ? 'Укажите причину отказа' : 'Выберите хотя бы одно поле')
    if (action === 'REJECT') await dialog.getByLabel('Код причины отказа').fill('MANUAL_POLICY_REJECT')
    else await dialog.getByLabel('Выручка за последние 12 месяцев').check()
    await dialog.getByRole('button', { name: label, exact: true }).click()
    await expect(dialog).not.toBeVisible()
    expect(captured).toMatchObject({ action, version: 3, comment: 'Проверены сведения клиента' })
    expect(captured).toMatchObject(action === 'REJECT'
      ? { decision_reason_code: 'MANUAL_POLICY_REJECT' }
      : { decision_reason_code: 'MISSING_FINANCIALS', missing_fields: ['business_data.financials.annual_revenue'] })
  })
}

test('Одобрение на мобильном: серверные лимиты, ошибка политики, один запрос и итоговые условия', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let calls = 0
  let release
  let captured
  await setup(page, async (route, current, update) => {
    calls++
    captured = route.request().postDataJSON()
    if (calls === 1) return route.fulfill({ status: 422, json: { message: 'Сумма превышает безопасный лимит платежей' } })
    await new Promise(resolve => { release = resolve })
    const result = { ...current, status: 'APPROVED', next_actions: [], version: 4,
      offer: { kind: 'COUNTER_OFFER', amount: '500000.00', annual_rate_pct: '22.70', term_months: 24, monthly_payment: '26101.20', monthly_cash_flow: '100000.00', existing_debt_payments: '40000.00', max_total_debt_service: '74074.07', dscr: '1.51', target_dscr: '1.35', explanation: 'Допустимая сумма рассчитана сервером по денежному потоку.' } }
    update(result)
    await route.fulfill({ json: result })
  })
  await page.getByRole('button', { name: 'Одобрить', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Комментарий', { exact: true }).fill('Подтверждаем безопасный лимит')
  await dialog.getByLabel('Одобренная сумма').fill('200000')
  await dialog.getByRole('button', { name: 'Одобрить', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('250 000')
  expect(calls).toBe(0)
  await dialog.getByLabel('Одобренная сумма').fill('600000')
  await dialog.getByRole('button', { name: 'Одобрить', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('безопасный лимит')
  await dialog.getByLabel('Одобренная сумма').fill('500000,00')
  await dialog.getByRole('button', { name: 'Одобрить', exact: true }).click()
  await expect.poll(() => calls).toBe(2)
  await expect(dialog.getByLabel('Комментарий', { exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Закрыть окно' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Одобрить', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  release()
  await expect(dialog).not.toBeVisible()
  expect(captured).toEqual({ action: 'APPROVE', version: 3, comment: 'Подтверждаем безопасный лимит', approved_amount: '500000.00' })
  await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('button', { name: 'История решений' }).click()
  await expect(page.locator('.credit-offer__amount')).toHaveText('500 000 ₽')
  await expect(page.getByText('22,7% годовых · 24 мес.', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
})

test('Конфликт версии с недоступной карточкой блокирует устаревшие действия до обновления', async ({ page }) => {
  const controls = await setup(page, (route, current, update, unavailable) => {
    update({ ...current, version: 4, next_actions: ['REQUEST_INFO'] })
    unavailable(true)
    return route.fulfill({ status: 409, json: { message: 'Version conflict' } })
  })
  await page.getByRole('button', { name: 'Отказать', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Комментарий', { exact: true }).fill('Проверено')
  await dialog.getByLabel('Код причины отказа').fill('MANUAL_POLICY_REJECT')
  await dialog.getByRole('button', { name: 'Отказать', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText('Заявка изменилась, но загрузить её текущую версию не удалось. Обновите карточку перед новым действием.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Одобрить', exact: true })).toBeDisabled()
  controls.recover()
  await page.getByRole('button', { name: 'Обновить карточку', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Запросить сведения', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Одобрить', exact: true })).toHaveCount(0)
})
