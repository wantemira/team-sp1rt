import { expect, test } from '@playwright/test'

const password = process.env.E2E_PASSWORD || 'password123'
async function login(page, email, role = 'client') {
  await page.goto('/login')
  await page.getByLabel('Электронная почта', { exact: true }).fill(email)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page).toHaveURL(role === 'employee' ? /\/employee\/applications$/ : /\/client$/)
}
async function expectRussian(page) {
  const text = (await page.locator('main').innerText()).replace(/[\w.+-]+@[\w.-]+/g, '')
  expect(text.match(/[A-Za-z]{2,}(?:[-_][A-Za-z0-9]+)*/g)).toBeNull()
  for (const title of await page.locator('main [title]').evaluateAll(elements => elements.map(element => element.title))) {
    expect(title).not.toMatch(/NEEDS_INFO|MANUAL_REVIEW|APPROVED|cash-flow-demo/)
  }
}

test('Старые расчёты, комментарии и коды не попадают в карточку сотрудника', async ({ page }) => {
  const application = {
    id: 900006, company_name: 'Test Client 1', client: { company_name: 'Test Client 1' },
    product_type: 'term_loan', requested_amount: '434444.00', requested_term_months: 12,
    status: 'NEEDS_INFO', score: null, risk_grade: null, version: 3, next_actions: [],
    decision_reason_code: 'MISSING_FINANCIAL_INFORMATION', info_comment: 'Provide the requested financial information.',
    missing_fields: ['business_data.financials.annual_revenue'], business_data: { financials: {} },
    scoring_result: { rules_version: 'cash-flow-demo-v1', factors: [{ code: 'DSCR', label: 'DSCR factor', points: '0', explanation: 'Internal description' }] },
    checks: [{ id: 1, check_type: 'FUTURE_SOURCE', status: 'SUCCESS' }], documents: [],
    status_history: [{ id: 1, new_status: 'DRAFT', comment: 'Draft created.' }, { id: 2, new_status: 'NEEDS_INFO', comment: 'Provide the requested financial information.' }],
  }
  await page.route('**/api/v1/employee/applications**', route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/900006') ? application : [application] }))
  await login(page, 'test.employee1@example.com', 'employee')
  await expect(page.getByText('Заполните запрошенные финансовые показатели.', { exact: true })).toBeVisible()
  await expect(page.getByText('Не определён', { exact: true })).toBeVisible()
  await expectRussian(page)
  await page.getByRole('tab', { name: 'Проверки и скоринг', exact: true }).click()
  await expect(page.getByText('Покрытие долговых платежей', { exact: true })).toBeVisible()
  await expectRussian(page)
  await page.getByRole('tab', { name: 'История', exact: true }).click()
  await expect(page.getByText('Черновик сохранён.', { exact: true })).toBeVisible()
  await expectRussian(page)
})

test('Запрос сведений и документы понятны в обоих кабинетах на настоящем API', async ({ page }) => {
  await page.goto('/login')
  await page.getByText('Клиент и сотрудник: какой аккаунт выбрать', { exact: true }).click()
  await expect(page.getByText('demo.review@example.com — клиент, чья заявка передаётся на ручное рассмотрение.', { exact: true })).toBeVisible()
  await login(page, 'test.client1@example.com')
  await page.goto('/client/applications/new')
  await page.getByLabel('Сумма кредита', { exact: true }).fill('434444')
  await page.getByRole('button', { name: 'Отправить заявку', exact: true }).click()
  await expect(page).toHaveURL(/\/client\/applications\/\d+$/)
  const id = new URL(page.url()).pathname.split('/').at(-1)
  await expect(page.getByText('Заполните запрошенные финансовые показатели.', { exact: true })).toBeVisible()
  await expectRussian(page)
  await page.goto('/client/documents')
  await page.getByLabel('Заявка', { exact: true }).selectOption(id)
  await page.locator('input[type=file]').setInputFiles({ name: 'отчёт.txt', mimeType: 'text/plain', buffer: Buffer.from('Финансовый отчёт') })
  await expect(page.locator('.document-list')).toContainText('Финансовый отчёт')
  await expectRussian(page)
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await login(page, 'test.employee1@example.com', 'employee')
  await page.goto(`/employee/applications?status=REVIEW&application=${id}`)
  await expect(page.getByText('Заполните запрошенные финансовые показатели.', { exact: true })).toBeVisible()
  await expectRussian(page)
  await page.getByRole('tab', { name: 'История', exact: true }).click()
  await expectRussian(page)
})
