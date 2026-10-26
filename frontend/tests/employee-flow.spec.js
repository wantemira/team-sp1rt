import { expect, test } from '@playwright/test'
const password = process.env.E2E_PASSWORD || 'password123'
async function login(page, email, role = 'client') {
  await page.goto('/login')
  await page.getByLabel('Электронная почта', { exact: true }).fill(email)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page).toHaveURL(role === 'client' ? /\/client$/ : /\/employee\/applications$/)
}

test('Сотрудник повторяет проверку, клиент дозаполняет заявку и получает полный лимит', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await login(page, 'test.client3@example.com')
  await page.goto('/client/applications/new')
  await page.getByLabel('Сумма кредита', { exact: true }).fill('1000000')
  await page.getByRole('button', { name: 'Отправить заявку', exact: true }).click()
  await expect(page).toHaveURL(/\/client\/applications\/\d+$/)
  const path = new URL(page.url()).pathname
  const id = path.split('/').at(-1)
  await expect(page.getByText('Источник временно не ответил. Сотрудник повторит проверку.', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await login(page, 'test.employee1@example.com', 'employee')
  await page.locator('.application-queue button').filter({ hasText: `№${id}` }).click()
  await expect(page.getByRole('button', { name: 'Повторить проверки', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Одобрить', exact: true })).toHaveCount(0)
  const retry = page.waitForResponse(response => response.url().endsWith(`/applications/${id}/retry-checks`) && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Повторить проверки', exact: true }).click()
  expect((await retry).ok()).toBeTruthy()
  await expect(page.locator('.application-queue button').filter({ hasText: `№${id}` })).toHaveCount(0)
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await login(page, 'test.client3@example.com')
  await page.goto(path)
  await page.getByLabel('Выручка за последние 12 месяцев', { exact: true }).fill('6000000')
  await page.getByRole('button', { name: 'Отправить сведения', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Кредит одобрен', exact: true })).toBeVisible()
  await expect(page.locator('.credit-offer__amount').first()).toContainText('1 000 000')
  await expect(page.getByRole('button', { name: 'Согласен с предложением', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})
