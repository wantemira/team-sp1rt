import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
const password = process.env.E2E_PASSWORD || 'password123'

test('Документ сохраняется в заявке и скачивается с исходным содержимым', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill('demo.ip@example.com')
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page).toHaveURL(/\/client$/)
  await page.goto('/client/applications/new')
  await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click()
  await expect(page).toHaveURL(/draft=\d+/)
  const id = new URL(page.url()).searchParams.get('draft')
  await page.goto('/client/documents')
  await page.getByLabel('Заявка', { exact: true }).selectOption(id)
  const contents = 'Synthetic financial report for the credit demo.'
  await page.locator('input[type=file]').setInputFiles({ name: 'report.txt', mimeType: 'text/plain', buffer: Buffer.from(contents) })
  const row = page.locator('.document-list li').filter({ hasText: `Заявка №${id}` })
  await expect(row).toHaveCount(1)
  const downloaded = page.waitForEvent('download')
  await row.getByRole('button', { name: 'Скачать', exact: true }).click()
  const download = await downloaded
  expect(await readFile(await download.path(), 'utf8')).toBe(contents)
  await page.reload()
  await expect(page.locator('.document-list li').filter({ hasText: `Заявка №${id}` })).toHaveCount(1)
})
