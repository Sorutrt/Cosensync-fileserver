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
    const testImageBuffer = Buffer.from('test image');
    const uploadResponse = await request.post(`${BASE_URL}/api/upload`, {
      multipart: {
        image: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: testImageBuffer
        }
      }
    });

    expect(uploadResponse.status()).toBe(200);
    const uploadResult = await uploadResponse.json();
    expect(uploadResult.success).toBe(true);
    expect(uploadResult.filename).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.png$/);

    // 2. アップロードされたファイルにアクセス可能
    const fileResponse = await request.get(uploadResult.url);
    expect(fileResponse.status()).toBe(200);
    expect(fileResponse.headers()['content-type']).toMatch(/^image\//);

    // バックアップに含まれないファイルも用意する
    const unnecessaryFile = '11111111-1111-1111-1111-111111111111.png';
    fs.writeFileSync(
      path.join(TEST_UPLOADS_DIR, unnecessaryFile),
      testImageBuffer
    );

    const backupData = Buffer.from(JSON.stringify({
      pages: [{ lines: [`[${uploadResult.url}]`] }]
    }));
    const gcResponse = await request.post(`${BASE_URL}/api/gc`, {
      multipart: {
        backup: {
          name: 'backup.json',
          mimeType: 'application/json',
          buffer: backupData
        }
      }
    });

    expect(gcResponse.status()).toBe(200);
    const gcResult = await gcResponse.json();
    expect(gcResult.success).toBe(true);
    expect(gcResult.deletedFiles).toContain(unnecessaryFile);

    // バックアップで参照したファイルだけが残る
    expect(fs.existsSync(path.join(TEST_UPLOADS_DIR, uploadResult.filename))).toBe(true);
    expect(fs.existsSync(path.join(TEST_UPLOADS_DIR, unnecessaryFile))).toBe(false);
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
      const requestPromise = request.post(`${BASE_URL}/api/upload`, {
        multipart: {
          image: {
            name: `test${i}.png`,
            mimeType: 'image/png',
            buffer: testImageBuffer
          }
        }
      });
      
      concurrentRequests.push(requestPromise);
    }

    // すべてのリクエストが完了するのを待機
    const responses = await Promise.all(concurrentRequests);
    
    // すべてのリクエストが成功し、異なるファイル名になることを確認
    const filenames = [];
    for (const response of responses) {
      expect(response.status()).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.png$/);
      filenames.push(result.filename);
    }

    const uniqueFilenames = new Set(filenames);
    expect(uniqueFilenames.size).toBe(filenames.length);
  });

});
