import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end golden paths against a running lexly-backend (plan §3.9). They are not part of CI:
 * start the backend first (see CLAUDE.md), then `npm run test:e2e`. The dev server is reused if it
 * is already running, since the backend's CORS only allows http://localhost:5173.
 *
 * `PW_CHROMIUM_PATH` points Playwright at an already-installed Chromium instead of the one
 * `npx playwright install chromium` downloads.
 */
const executablePath = process.env.PW_CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  // The dev server compiles a page on its first visit; the first assertion of a run can wait for that.
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
