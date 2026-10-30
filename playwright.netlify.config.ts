import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/production-e2e', workers: 1, fullyParallel: false, retries: 0, timeout: 60_000,
  grep: /production routes|production APIs|real synthetic legacy SQLite/,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/netlify' }]],
  use: { baseURL: 'http://127.0.0.1:8084', timezoneId: 'Asia/Shanghai', trace: 'retain-on-failure' },
  projects: [{ name: 'netlify-simulation', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } }],
  webServer: { command: 'node scripts/test-netlify-bundle.mjs', url: 'http://127.0.0.1:8084/healthz', reuseExistingServer: false,
    env: { QLOO_API_KEY: '', QLOO_BASE_URL: '', EXPO_NO_DOTENV: '1' } },
});
