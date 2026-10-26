import { expect, test } from '@playwright/test'
const password = process.env.E2E_PASSWORD || 'password123'
async function login(page) {
  await page.goto('/login')
  await page.getByLabel('Электронная почта', { exact: true }).fill('demo.ip@example.com')
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page).toHaveURL(/\/client$/)
}

test('Во время настоящей отправки ожидание сохранения отделено от ожидания ФНС и БКИ', async ({ page }) => {
  await login(page)
  let saveReady, checksReady
  const saving = new Promise(resolve => { saveReady = resolve })
  const checking = new Promise(resolve => { checksReady = resolve })
  await page.route('**/api/v1/applications', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    await saving
    await route.continue()
  })
  await page.route('**/api/v1/applications/*/submit', async route => {
    await checking
    await route.continue()
  })
  await page.goto('/client/applications/new')
  await page.getByLabel('Сумма кредита', { exact: true }).fill('1000000')
  await page.getByRole('button', { name: 'Отправить заявку', exact: true }).click()
  await expect(page.getByText('Сохраняем параметры заявки…', { exact: true })).toBeVisible()
  await expect(page.getByText('Проверка по ЕГРИП (ФНС)… Запрос в БКИ…', { exact: true })).toHaveCount(0)
  saveReady()
  await expect(page.getByText('Проверка по ЕГРИП (ФНС)… Запрос в БКИ…', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Отправить заявку', exact: true })).toBeDisabled()
  checksReady()
  await expect(page).toHaveURL(/\/client\/applications\/\d+$/)
  await expect(page.getByRole('heading', { name: 'Предложение для вашего бизнеса', exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Текущие результаты проверок' })).toContainText('Ответ источника получен')
})

// Граничные сценарии интерфейса с подменёнными версиями ответа API.
function approved() {
  return { id: 900002, product_type: 'term_loan', requested_amount: '1000000.00', requested_term_months: 24,
    status: 'APPROVED', version: 3, next_actions: ['SIGN'], checks: [], status_history: [],
    offer: { kind: 'COUNTER_OFFER', amount: '600000.00', annual_rate_pct: '20.1539', term_months: 24,
      monthly_payment: '30582.63', monthly_cash_flow: '100000.00', existing_debt_payments: '43000.00',
      max_total_debt_service: '74074.07', dscr: '1.35', requested_dscr: '1.06', target_dscr: '1.35', explanation: 'Сумма рассчитана сервером.' } }
}
test('После конфликта согласия недоступные условия блокируются до перечитывания и нового подтверждения', async ({ page }) => {
  await login(page)
  let current = approved()
  let unavailable = false
  const versions = []
  await page.route('**/api/v1/applications/900002', route => unavailable
    ? route.fulfill({ status: 503, json: { message: 'Сервис временно недоступен' } })
    : route.fulfill({ json: current }))
  await page.route('**/api/v1/applications/900002/sign', route => {
    versions.push(route.request().postDataJSON().version)
    if (versions.length === 1) {
      unavailable = true
      current = { ...current, version: 4, offer: { ...current.offer, amount: '550000.00', monthly_payment: '28034.08' } }
      return route.fulfill({ status: 409, json: { message: 'Version conflict' } })
    }
    current = { ...current, version: 5, status: 'ISSUED', next_actions: [] }
    return route.fulfill({ json: current })
  })
  await page.goto('/client/applications/900002')
  await page.getByRole('button', { name: 'Согласен с предложением', exact: true }).click()
  await page.getByRole('button', { name: 'Подтвердить согласие', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByText('Условия изменились, но загрузить их текущую версию не удалось. Обновите заявку перед следующим действием.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Согласен с предложением', exact: true })).toHaveCount(0)
  unavailable = false
  await page.getByRole('button', { name: 'Обновить заявку', exact: true }).click()
  await expect(page.locator('.credit-offer__amount')).toHaveText('550 000 ₽')
  await page.getByRole('button', { name: 'Согласен с предложением', exact: true }).click()
  await expect(page.getByRole('dialog').locator('.credit-offer__amount')).toHaveText('550 000 ₽')
  await page.getByRole('button', { name: 'Подтвердить согласие', exact: true }).click()
  await expect(page.getByText('Предложение принято', { exact: true })).toBeVisible()
  expect(versions).toEqual([3, 4])
})

test('Недоступный и конфликтующий черновик можно восстановить без отправки устаревшей версии', async ({ page }) => {
  await login(page)
  let unavailable = true
  let current = { id: 900003, status: 'DRAFT', version: 2, requested_amount: '800000.00', requested_term_months: 12 }
  let patches = 0
  await page.route('**/api/v1/applications/900003', route => {
    if (route.request().method() === 'PATCH') {
      patches++
      unavailable = true
      current = { ...current, version: 3, requested_amount: '700000.00' }
      return route.fulfill({ status: 409, json: { message: 'Version conflict' } })
    }
    return unavailable ? route.fulfill({ status: 503, json: { message: 'Черновик временно недоступен' } }) : route.fulfill({ json: current })
  })
  await page.goto('/client/applications/new?draft=900003')
  await expect(page.getByRole('alert')).toContainText('Черновик временно недоступен')
  await expect(page.getByRole('button', { name: 'Обновить черновик', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Отправить заявку', exact: true })).toHaveCount(0)
  unavailable = false
  await page.getByRole('button', { name: 'Обновить черновик', exact: true }).click()
  await expect(page.getByLabel('Сумма кредита', { exact: true })).toHaveValue('800000.00')
  await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click()
  await expect(page.getByText('Заявка изменилась, но загрузить её текущую версию не удалось. Обновите черновик перед отправкой.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Отправить заявку', exact: true })).toHaveCount(0)
  expect(patches).toBe(1)
  unavailable = false
  await page.getByRole('button', { name: 'Обновить черновик', exact: true }).click()
  await expect(page.getByLabel('Сумма кредита', { exact: true })).toHaveValue('700000.00')
})
