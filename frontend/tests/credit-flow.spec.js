import { expect, test } from '@playwright/test'
const password = process.env.E2E_PASSWORD || 'password123'
async function login(page, email) {
  await page.goto('/login')
  await page.getByLabel('Электронная почта', { exact: true }).fill(email)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page).toHaveURL(/\/client$/)
}

test('ИП сохраняет черновик, получает counter-offer и принимает сохранённые условия', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await login(page, 'demo.ip@example.com')
  await page.goto('/client/applications/new')
  await expect(page.getByLabel('ИНН', { exact: true })).toHaveValue('770000000001')
  await page.getByLabel('Сумма кредита', { exact: true }).fill('1 000 000')
  await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click()
  await expect(page).toHaveURL(/draft=\d+/)
  await page.reload()
  await expect(page.getByLabel('Сумма кредита', { exact: true })).toHaveValue('1000000.00')
  await page.getByRole('button', { name: 'Отправить заявку', exact: true }).click()
  await expect(page).toHaveURL(/\/client\/applications\/\d+$/)
  await expect(page.getByRole('heading', { name: 'Предложение для вашего бизнеса' })).toBeVisible()
  await expect(page.locator('.credit-offer__amount').first()).toContainText('609')
  await expect(page.getByText('Почему предлагаем другую сумму', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Согласен с предложением', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.credit-offer__amount')).toContainText('609')
  await dialog.getByRole('button', { name: 'Подтвердить согласие', exact: true }).click()
  await expect(page.getByText('Предложение принято', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Согласен с предложением', exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Предложение принято', { exact: true })).toBeVisible()
  await expect(page.locator('.credit-offer__amount').first()).toContainText('609')
  const issuedPath = new URL(page.url()).pathname
  await page.setViewportSize({ width: 390, height: 844 })
  for (const [path, heading] of [
    ['/client', 'Кредитный кабинет'], ['/client/products', 'Продукты'],
    ['/client/applications', 'Мои заявки'], ['/client/applications/new', 'Кредит на оборотные средства'],
    ['/client/documents', 'Документы'], [issuedPath, /^Заявка №/],
  ]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading, exact: typeof heading === 'string' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true)
  }
  expect(errors).toEqual([])
})

test('Отказ объясняется, а чужая заявка недоступна', async ({ page, request }) => {
  const auth = await request.post('/api/v1/auth/login', { data: { email: 'demo.ip@example.com', password } })
  expect(auth.ok()).toBeTruthy()
  const owner = await auth.json()
  const created = await request.post('/api/v1/applications', {
    headers: { Authorization: `Bearer ${owner.access_token}` }, data: { product_type: 'term_loan' },
  })
  const foreign = await created.json()
  await login(page, 'test.client2@example.com')
  await page.goto(`/client/applications/${foreign.id}`)
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('heading', { name: `Заявка №${foreign.id}` })).toHaveCount(0)
  await page.goto('/client/applications/new')
  await page.getByLabel('Сумма кредита', { exact: true }).fill('1000000')
  await page.getByRole('button', { name: 'Отправить заявку', exact: true }).click()
  await expect(page.getByText('Для этого продукта бизнес должен работать не менее года.', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Согласен с предложением', exact: true })).toHaveCount(0)
})
