/**
 * Playwrightグローバルティアダウン
 * すべてのテスト実行後に1度だけ実行される
 */

import { stopTestServer } from './test-helpers';

/**
 * テスト実行後のグローバルティアダウン
 * テストサーバーを停止する
 */
async function globalTeardown() {
  console.log('🛑 テストサーバーを停止しています...');
  
  try {
    await stopTestServer();
    console.log('✅ テストサーバーが停止しました');
  } catch (error) {
    console.error('❌ テストサーバーの停止に失敗しました:', error);
  }
}

export default globalTeardown;

