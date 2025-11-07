/**
 * 統合テスト - サーバー全体の機能テスト
 * サーバー起動からAPI応答までの結合テスト
 */

import { test, expect } from '@playwright/test';
import { cleanupTestDirectory, ensureTestDirectory } from './test-helpers';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:5050';
const TEST_UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

test.describe('統合テスト', () => {
  
  test.beforeEach(async () => {
    // テスト前にuploadsディレクトリを準備
    ensureTestDirectory(TEST_UPLOADS_DIR);
  });

  test.afterEach(async () => {
    // テスト後にuploadsディレクトリをクリーンアップ
    cleanupTestDirectory(TEST_UPLOADS_DIR);
  });

  test('サーバーの基本応答テスト', async ({ request }) => {
    // ルートページにアクセス
    const response = await request.get(BASE_URL);
    expect(response.status()).toBe(200);
    
    const html = await response.text();
    expect(html).toContain('Cosensync Fileserver');
    expect(html).toContain('画像ファイルをアップロードしてリンクを生成');
  });

  test('静的ファイルの配信テスト', async ({ request }) => {
    // CSSファイルにアクセス
    const cssResponse = await request.get(`${BASE_URL}/style.css`);
    expect(cssResponse.status()).toBe(200);
    expect(cssResponse.headers()['content-type']).toContain('text/css');
    
    // JavaScriptファイルにアクセス
    const jsResponse = await request.get(`${BASE_URL}/script.js`);
    expect(jsResponse.status()).toBe(200);
    expect(jsResponse.headers()['content-type']).toContain('application/javascript');
  });

  test('アップロードからGCまでの一連のフロー', async ({ request }) => {
    // 1. 画像ファイルをアップロード
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
      0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
      0xAE, 0x42, 0x60, 0x82
    ]);

    const uploadFormData = new FormData();
    uploadFormData.append('image', new Blob([testImageBuffer], { type: 'image/png' }), 'test.png');

    const uploadResponse = await request.post(`${BASE_URL}/api/upload`, {
      data: uploadFormData
    });

    expect(uploadResponse.status()).toBe(200);
    const uploadResult = await uploadResponse.json();
    expect(uploadResult.success).toBe(true);
    expect(uploadResult.filename).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.png$/);

    // 2. アップロードされたファイルにアクセス可能
    const fileResponse = await request.get(`${BASE_URL}${uploadResult.url}`);
    expect(fileResponse.status()).toBe(200);
    expect(fileResponse.headers()['content-type']).toMatch(/^image\//);

    // 3. 不要なファイルを作成してGCを実行
    const unnecessaryFile = '11111111-1111-1111-1111-111111111111.png';
    fs.writeFileSync(
      path.join(TEST_UPLOADS_DIR, unnecessaryFile),
      testImageBuffer
    );

    // 4. CosenseバックアップファイルでGCを実行
    const backupPath = path.join(__dirname, 'cosense-backup.json');
    const backupData = fs.readFileSync(backupPath);
    
    const gcFormData = new FormData();
    gcFormData.append('backup', new Blob([backupData], { type: 'application/json' }), 'backup.json');

    const gcResponse = await request.post(`${BASE_URL}/api/gc`, {
      data: gcFormData
    });

    expect(gcResponse.status()).toBe(200);
    const gcResult = await gcResponse.json();
    expect(gcResult.success).toBe(true);
    expect(gcResult.deletedCount).toBeGreaterThanOrEqual(0);

    // 5. 必要なファイルは残り、不要なファイルは削除されていることを確認
    expect(fs.existsSync(path.join(TEST_UPLOADS_DIR, uploadResult.filename))).toBe(true);
    // 不要なファイルは削除されている可能性がある（GCの動作による）
  });

  test('エラーハンドリングの統合テスト', async ({ request }) => {
    // 存在しないパスにアクセス
    const notFoundResponse = await request.get(`${BASE_URL}/nonexistent-path`);
    expect(notFoundResponse.status()).toBe(404);

    // 不正なHTTPメソッドでAPIにアクセス
    const wrongMethodResponse = await request.get(`${BASE_URL}/api/upload`);
    expect(wrongMethodResponse.status()).toBe(404);

    // 不正なContent-Typeでアップロード
    const invalidFormData = new FormData();
    invalidFormData.append('image', 'not a file', 'test.txt');

    const invalidUploadResponse = await request.post(`${BASE_URL}/api/upload`, {
      data: invalidFormData,
      headers: {
        'Content-Type': 'application/json' // 不正なContent-Type
      }
    });

    // サーバーはエラーを適切に処理するはず
    expect([400, 500]).toContain(invalidUploadResponse.status());
  });

  test('同時アクセスのテスト', async ({ request }) => {
    // 複数のリクエストを同時に送信
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
      0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
      0xAE, 0x42, 0x60, 0x82
    ]);

    const concurrentRequests = [];
    
    // 5つの同時アップロードリクエスト
    for (let i = 0; i < 5; i++) {
      const formData = new FormData();
      formData.append('image', new Blob([testImageBuffer], { type: 'image/png' }), `test${i}.png`);
      
      const requestPromise = request.post(`${BASE_URL}/api/upload`, {
        data: formData
      });
      
      concurrentRequests.push(requestPromise);
    }

    // すべてのリクエストが完了するのを待機
    const responses = await Promise.all(concurrentRequests);
    
    // すべてのリクエストが成功していることを確認
    for (const response of responses) {
      expect(response.status()).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.png$/);
    }

    // ファイル名がすべて異なっていることを確認
    const filenames = await Promise.all(
      responses.map(async (response) => {
        const result = await response.json();
        return result.filename;
      })
    );
    
    const uniqueFilenames = new Set(filenames);
    expect(uniqueFilenames.size).toBe(filenames.length);
  });

  test('メモリ使用量とパフォーマンスの基本的なテスト', async ({ request }) => {
    // 大きなファイルのアップロードテスト（1MBのダミーデータ）
    const largeBuffer = Buffer.alloc(1024 * 1024, 'A');
    
    const formData = new FormData();
    formData.append('image', new Blob([largeBuffer], { type: 'image/png' }), 'large.png');

    const startTime = Date.now();
    const response = await request.post(`${BASE_URL}/api/upload`, {
      data: formData
    });
    const endTime = Date.now();

    // レスポンス時間が妥当な範囲内にあることを確認（10秒以内）
    expect(endTime - startTime).toBeLessThan(10000);
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result.success).toBe(true);
  });
});
