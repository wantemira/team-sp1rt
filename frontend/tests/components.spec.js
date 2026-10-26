import { expect, test } from '@playwright/test'

test('Вкладки доступны с клавиатуры, поля связаны с ошибками', async ({ page }) => {
  await page.goto('/dev')
  await page.getByRole('tab', { name: 'Общая информация', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'История', exact: true })).toBeFocused()
  await expect(page.getByRole('tabpanel').filter({ visible: true })).toContainText('Содержимое второй вкладки')
  await expect(page.getByLabel('Сумма кредита', { exact: true })).toHaveAttribute('aria-invalid', 'true')
})

test('Фиктивный пароль не даёт доступ к кабинету', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill('demo.ip@example.com')
  await page.getByLabel('Пароль', { exact: true }).fill('123')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/client/applications')
  await expect(page).toHaveURL(/\/login$/)
})
