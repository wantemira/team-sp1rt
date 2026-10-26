import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const mode = process.argv[2]
if (!['ui', 'collection'].includes(mode)) {
  console.error('Укажите режим ui или collection.')
  process.exit(1)
}
try {
  process.loadEnvFile(process.env.ENV_FILE || '.env')
} catch {
  console.error('Не удалось прочитать файл окружения. Выполните make init или задайте ENV_FILE.')
  process.exit(1)
}
if (!process.env.TEST_USERS_PASSWORD) {
  console.error('Задайте TEST_USERS_PASSWORD в файле окружения.')
  process.exit(1)
}
const base = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${process.env.WEB_PORT || 8080}`
const env = { ...process.env, PLAYWRIGHT_BASE_URL: base, E2E_PASSWORD: process.env.E2E_PASSWORD || process.env.TEST_USERS_PASSWORD }
const root = fileURLToPath(new URL('../', import.meta.url))
const args = mode === 'ui'
  ? ['run', 'test:ui', '--prefix', 'frontend']
  : ['exec', '--yes', '--package=newman@6.2.1', '--', 'newman', 'run', 'docs/credit-demo.postman_collection.json', '--env-var', `base_url=${process.env.DEMO_API_URL || `${base}/api/v1`}`, '--env-var', `demo_password=${process.env.TEST_USERS_PASSWORD}`, '--bail']
const result = spawnSync(process.env.NPM || 'npm', args, { cwd: root, env, stdio: 'inherit' })
if (result.error) console.error('Не удалось запустить npm. Проверьте установку Node.js.')
process.exit(result.status ?? 1)
