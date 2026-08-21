import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright テスト設定
 * E2EテストとAPIテストの両方に対応
 */
export default defineConfig({
  testDir: 'tests',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  reporter: 'html',
  
  use: {
    trace: 'on-first-retry',
    ...devices['Desktop Chrome']
  },

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5050',
    reuseExistingServer: false,
    timeout: 10000
  },

  // API/GCテストは同じuploadsディレクトリを操作するため直列実行する
  workers: 1
});