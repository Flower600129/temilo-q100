import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/mobile-e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:8083', timezoneId: 'Asia/Shanghai', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'node scripts/start-preview.mjs --test-server',
    url: 'http://127.0.0.1:8083/api/taste/status',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { CI: '1', EXPO_NO_DOTENV: '1', QLOO_API_KEY: '', QLOO_BASE_URL: '', EXPO_PUBLIC_API_URL: '' },
  },
});
