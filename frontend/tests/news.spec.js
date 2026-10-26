import { expect, test } from '@playwright/test'

const password = process.env.E2E_PASSWORD || 'password123'
async function login(page, email) {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page).toHaveURL(/\/client$/)
}

test('Лента различает ИП и организацию и меняется после встречного предложения', async ({ page }) => {
  await login(page, 'demo.ip@example.com')
  const profile = page.locator('.news-feed details').filter({ hasText: 'Оборотный кредит для ИП' })
  await profile.locator('summary').click()
  await expect(profile.getByText('Ваш профиль — индивидуальный предприниматель.', { exact: true })).toBeVisible()
  await expect(profile).toContainText('ЕГРИП')
  await page.goto('/client/applications/new')
  await page.getByLabel('Сумма кредита', { exact: true }).fill('1000000')
  await page.getByRole('button', { name: 'Отправить заявку', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Предложение для вашего бизнеса' })).toBeVisible()
  await page.goto('/client')
  const offer = page.locator('.news-feed details').filter({ hasText: 'Почему предложенная сумма меньше запрошенной' })
  await offer.locator('summary').click()
  await expect(offer).toContainText('DSCR должен быть не ниже 1,35')
  await expect(offer).toContainText('По вашей последней заявке рассчитано встречное предложение.')
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await login(page, 'test.client1@example.com')
  const company = page.locator('.news-feed details').filter({ hasText: 'Оборотный кредит для организации' })
  await company.locator('summary').click()
  await expect(company).toContainText('Ваш профиль — организация.')
  await expect(company).toContainText('ЕГРЮЛ')
  await expect(page.locator('.news-feed')).not.toContainText('Оборотный кредит для ИП')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
