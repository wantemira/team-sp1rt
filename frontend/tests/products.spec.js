import { expect, test } from '@playwright/test'
const password = process.env.E2E_PASSWORD || 'password123'
const product = { id: 'term_loan', name: 'Кредит на оборотные средства', min_amount: '250000.00', max_amount: '2000000.50', terms: [12] }
async function login(page) {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill('demo.ip@example.com')
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page).toHaveURL(/\/client$/)
}

test('Каталог и форма используют изменённые лимиты и сроки из API', async ({ page }) => {
  await login(page)
  await page.route('**/api/v1/products', route => route.fulfill({ json: [product] }))
  await page.goto('/client/products')
  await expect(page.getByText('250 000 ₽ – 2 000 000,50 ₽', { exact: true })).toBeVisible()
  await expect(page.getByText('Решение за 1 день')).toHaveCount(0)
  await page.getByRole('button', { name: 'Оформить заявку' }).click()
  await expect(page.getByLabel('Срок кредита', { exact: true })).toHaveValue('12')
  await expect(page.getByLabel('Срок кредита', { exact: true }).locator('option')).toHaveCount(1)
  await page.getByLabel('Сумма кредита', { exact: true }).fill('100000')
  await page.getByRole('button', { name: 'Отправить заявку', exact: true }).click()
  await expect(page.getByLabel('Сумма кредита', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await page.getByLabel('Сумма кредита', { exact: true }).fill('250000.01')
  const created = page.waitForResponse(response => response.url().endsWith('/api/v1/applications') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click()
  const response = await created
  expect(response.ok()).toBeTruthy()
  expect(response.request().postDataJSON()).toMatchObject({ requested_amount: '250000.01', requested_term_months: 12 })
})

test('Пустой каталог и ошибка условий позволяют повторить загрузку без выдуманных лимитов', async ({ page }) => {
  await login(page)
  let mode = 'empty'
  await page.route('**/api/v1/products', route => mode === 'error'
    ? route.fulfill({ status: 503, json: { message: 'Условия временно недоступны' } })
    : route.fulfill({ json: mode === 'empty' ? [] : [product] }))
  await page.goto('/client/products')
  await expect(page.getByRole('heading', { name: 'Сейчас нет доступных продуктов' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Оформить заявку' })).toHaveCount(0)
  mode = 'ready'
  await page.getByRole('button', { name: 'Обновить', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Оформить заявку' })).toBeVisible()
  mode = 'error'
  await page.goto('/client/applications/new')
  await expect(page.getByRole('alert')).toContainText('Условия временно недоступны')
  await expect(page.getByRole('button', { name: 'Отправить заявку' })).toHaveCount(0)
  mode = 'ready'
  await page.getByRole('button', { name: 'Обновить условия' }).click()
  await expect(page.getByLabel('Сумма кредита', { exact: true })).toBeVisible()
})
