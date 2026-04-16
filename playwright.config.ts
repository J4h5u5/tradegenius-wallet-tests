import 'dotenv/config'
import { defineConfig } from '@playwright/test'

const appURL = process.env.BASE_URL ?? 'https://dev.tradegenius.com/asset'
const baseURL = new URL(appURL).origin

export default defineConfig({
  testDir: './test/e2e',
  timeout: 180_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL,
    headless: false,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry'
  }
})
