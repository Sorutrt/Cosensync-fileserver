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
  
  // グローバルセットアップとティアダウン
  globalSetup: require.resolve('./tests/global-setup.ts'),
  globalTeardown: require.resolve('./tests/global-teardown.ts'),
  
  use: {
    trace: 'on-first-retry',
    ...devices['Desktop Chrome']
  },
  
  // ワーカー数を制限してサーバーの競合を避ける
  workers: 3
});