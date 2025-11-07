/**
 * Playwrightグローバルセットアップ
 * すべてのテスト実行前に1度だけ実行される
 */

import { startTestServer } from './test-helpers';

/**
 * テスト実行前のグローバルセットアップ
 * テストサーバーを起動する
 */
async function globalSetup() {
  console.log('🚀 テストサーバーを起動しています...');
  
  try {
    await startTestServer();
    console.log('✅ テストサーバーが起動しました');
  } catch (error) {
    console.error('❌ テストサーバーの起動に失敗しました:', error);
    throw error;
  }
}

export default globalSetup;

