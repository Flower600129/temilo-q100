import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/production-e2e', workers: 1, fullyParallel: false, retries: 0, timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/production' }]],
  use: { baseURL: 'http://127.0.0.1:8084', timezoneId: 'Asia/Shanghai', trace: 'retain-on-failure' },
  projects: [{ name: 'production-mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } }],
  webServer: { command: 'node scripts/serve-production.mjs --test-server', url: 'http://127.0.0.1:8084/healthz', reuseExistingServer: false,
    env: { PORT: '8084', TEMILO_BIND: '127.0.0.1', TEMILO_QUOTA_FILE: `.local/production-tests/quota-${process.pid}-${Date.now()}.json`, TEMILO_QLOO_MINUTE_UNITS: '60', QLOO_API_KEY: '', QLOO_BASE_URL: '' } },
});
