import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1100 },
    browserName: 'chromium',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${process.env.FRONTEND_PORT || 5173} --strictPort`,
    url: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
})
