import { expect, test } from '@playwright/test'
const password = process.env.E2E_PASSWORD || 'password123'
async function login(page, email, employee = false) {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page).toHaveURL(employee ? /\/employee\/applications$/ : /\/client$/)
}
const region = page => page.getByRole('region', { name: 'Финансовые основания решения', exact: true })
const row = (basis, label) => basis.locator('dl > div').filter({ has: basis.page().getByText(label, { exact: true }) })

test('Сотрудник видит основания настоящего расчёта до одобрения и после перезагрузки', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await login(page, 'demo.review@example.com')
  await page.goto('/client/applications/new')
  await page.getByLabel('Сумма кредита', { exact: true }).fill('1000000')
  const submitted = page.waitForResponse(response => response.url().endsWith('/submit') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Отправить заявку', exact: true }).click()
  const response = await submitted
  expect(response.ok()).toBeTruthy()
  const application = await response.json()
  expect(application.status).toBe('MANUAL_REVIEW')
  await expect(page).toHaveURL(new RegExp(`/client/applications/${application.id}$`))
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await login(page, 'test.employee1@example.com', true)
  const chosen = () => page.locator('.application-queue button').filter({ has: page.getByText(new RegExp(`· №${application.id}$`)) })
  await chosen().click()
  const basis = region(page)
  await expect(row(basis, 'Выручка за 12 месяцев')).toContainText('2 400 000 ₽')
  await expect(row(basis, 'Выручка за 12 месяцев')).toContainText('ФНС')
  await expect(row(basis, 'Операционные расходы за 12 месяцев')).toContainText('1 200 000 ₽')
  await expect(row(basis, 'Операционный поток в месяц')).toContainText('100 000 ₽')
  await expect(row(basis, 'Платежи по действующим кредитам в месяц')).toContainText('0 ₽')
  await expect(row(basis, 'Активные кредиты').locator('dd')).toHaveText('0')
  await expect(row(basis, 'Платежи с задержкой за 12 месяцев')).toContainText('6 из 24')
  await expect(row(basis, 'Текущая просрочка')).toContainText('Нет текущей просрочки')
  await basis.screenshot({ path: test.info().outputPath('financial-basis-desktop.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await basis.screenshot({ path: test.info().outputPath('financial-basis-mobile.png') })
  await page.getByRole('button', { name: 'Одобрить', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Комментарий', { exact: true }).fill('Изучены поток 100 000 ₽, отсутствие текущего долга и 6 задержек из 24 платежей')
  const deciding = page.waitForResponse(response => response.url().endsWith(`/applications/${application.id}/action`))
  await dialog.getByRole('button', { name: 'Одобрить', exact: true }).click()
  expect((await deciding).ok()).toBeTruthy()
  await expect(dialog).not.toBeVisible()
  await page.goto('/employee/applications?status=HISTORY')
  await chosen().click()
  await expect(page).toHaveURL(new RegExp(`[?&]application=${application.id}(?:&|$)`))
  await page.reload()
  await expect(chosen()).toHaveAttribute('aria-current', 'true')
  await expect(row(region(page), 'Операционный поток в месяц')).toContainText('100 000 ₽')
  await expect(row(region(page), 'Платежи с задержкой за 12 месяцев')).toContainText('6 из 24')
  expect(errors).toEqual([])
})

test('Отсутствие истории отличается от недоступного БКИ; старые успешные данные не подставляются', async ({ page }) => {
  let failed = false
  const data = () => ({
    id: 900004, product_type: 'term_loan', requested_amount: '1000000.00', requested_term_months: 24,
    company_name: 'ИП Проверка данных', client: { company_name: 'ИП Проверка данных' }, status: 'MANUAL_REVIEW', version: 3,
    next_actions: failed ? ['RETRY_CHECKS'] : ['APPROVE', 'REJECT', 'REQUEST_INFO'], status_history: [],
    decision_reason_code: failed ? 'EXTERNAL_CHECK_UNAVAILABLE' : 'SCORE_REQUIRES_MANUAL_REVIEW',
    checks: [{ id: 1, check_type: 'BKI', status: 'SUCCESS', response_data: { monthly_debt_payments: '50000.00', total_payments_12m: 24, delayed_payments_12m: 0 } }],
    scoring_result: { inputs: {
      fns: { status: 'SUCCESS', annual_revenue: null, annual_operating_expenses: null },
      financials: { annual_revenue: '2400000.00', annual_expenses: '1200000.00' },
      bki: { status: failed ? 'TIMEOUT' : 'SUCCESS', monthly_debt_payments: '0.00', total_payments_12m: 0, delayed_payments_12m: 0, current_overdue_days: 0, active_loans_count: 0 },
    } },
  })
  await page.route('**/api/v1/employee/applications**', route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/900004') ? data() : [data()] }))
  await login(page, 'test.employee1@example.com', true)
  const basis = region(page)
  await expect(row(basis, 'Выручка за 12 месяцев')).toContainText('Данные клиента')
  await expect(row(basis, 'Платежи с задержкой за 12 месяцев')).toContainText('Нет истории платежей')
  await expect(row(basis, 'Платежи по действующим кредитам в месяц')).toContainText('0 ₽')
  failed = true
  await page.reload()
  await expect(basis).toContainText('Данные источников требуют повторной проверки')
  await expect(row(basis, 'Платежи с задержкой за 12 месяцев')).toContainText('Нет данных')
  await expect(row(basis, 'Платежи по действующим кредитам в месяц')).toContainText('Нет данных')
  await expect(row(basis, 'Текущая просрочка')).toContainText('Нет данных')
  await expect(basis).not.toContainText('50 000')
  await expect(page.getByRole('button', { name: 'Повторить проверки', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Одобрить', exact: true })).toHaveCount(0)
})
