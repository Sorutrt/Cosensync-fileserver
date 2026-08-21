/**
 * APIエンドポイントテスト - ファイルアップロード機能
 * /api/upload エンドポイントの正常系・異常系テスト
 */

import { test, expect, APIRequestContext } from '@playwright/test';
import { createTestImage, cleanupTestDirectory, ensureTestDirectory } from './test-helpers';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:5050';
const TEST_UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

function uploadImage(request: APIRequestContext, name: string, mimeType: string) {
  return request.post(`${BASE_URL}/api/upload`, {
    multipart: {
      image: {
        name,
        mimeType,
        buffer: createTestImage(name)
      }
    }
  });
}

test.describe('ファイルアップロードAPI', () => {
  
  test.beforeEach(async () => {
    // テスト前にuploadsディレクトリを準備
    ensureTestDirectory(TEST_UPLOADS_DIR);
  });

  test.afterEach(async () => {
    // テスト後にuploadsディレクトリをクリーンアップ
    cleanupTestDirectory(TEST_UPLOADS_DIR);
  });

  test('正常系：画像ファイルのアップロード', async ({ request }) => {
    const response = await uploadImage(request, 'test.png', 'image/png');

    // レスポンスの検証
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('filename');
    expect(result.url).toContain('/uploads/');
    expect(result.filename).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.png$/);

    // ファイルが実際に保存されていることを確認
    const filePath = path.join(TEST_UPLOADS_DIR, result.filename);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  test('正常系：JPEGファイルのアップロード', async ({ request }) => {
    const response = await uploadImage(request, 'test.jpg', 'image/jpeg');

    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.filename).toMatch(/\.jpg$/);
  });

  test('異常系：ファイルなしでアップロード', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/upload`, {
      multipart: {}
    });

    expect(response.status()).toBe(400);
    
    const result = await response.json();
    expect(result).toHaveProperty('error', 'ファイルが選択されていません');
  });

  test('異常系：画像以外のファイルをアップロード', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/upload`, {
      multipart: {
        image: {
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('This is not an image file')
        }
      }
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('application/json');
    const result = await response.json();
    expect(result).toHaveProperty('error', '画像ファイルのみアップロード可能です');
    expect(fs.readdirSync(TEST_UPLOADS_DIR).filter(file => file.endsWith('.txt'))).toEqual([]);
  });

  test('正常系：複数ファイルの連続アップロード', async ({ request }) => {
    const files = [
      { name: 'test1.png', data: createTestImage('test1.png') },
      { name: 'test2.jpg', data: createTestImage('test2.jpg') },
      { name: 'test3.png', data: createTestImage('test3.png') }
    ];

    const uploadedFiles = [];

    for (const file of files) {
      const response = await uploadImage(request, file.name, file.name.endsWith('.jpg') ? 'image/jpeg' : 'image/png');

      expect(response.status()).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      uploadedFiles.push(result.filename);
    }

    // すべてのファイルが異なる名前で保存されていることを確認
    const uniqueFiles = new Set(uploadedFiles);
    expect(uniqueFiles.size).toBe(uploadedFiles.length);

    // すべてのファイルが実際に存在することを確認
    for (const filename of uploadedFiles) {
      const filePath = path.join(TEST_UPLOADS_DIR, filename);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  test('正常系：アップロードされたファイルにアクセス可能', async ({ request }) => {
    const uploadResponse = await uploadImage(request, 'test-access.png', 'image/png');

    expect(uploadResponse.status()).toBe(200);
    
    const uploadResult = await uploadResponse.json();
    
    // アップロードされたファイルにアクセスできることを確認
    const fileResponse = await request.get(uploadResult.url);
    expect(fileResponse.status()).toBe(200);
    
    // レスポンスが画像データであることを確認
    const contentType = fileResponse.headers()['content-type'];
    expect(contentType).toMatch(/^image\//);
  });
});
