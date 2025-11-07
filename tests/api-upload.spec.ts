/**
 * APIエンドポイントテスト - ファイルアップロード機能
 * /api/upload エンドポイントの正常系・異常系テスト
 */

import { test, expect } from '@playwright/test';
import { createTestImage, cleanupTestDirectory, ensureTestDirectory } from './test-helpers';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:5050';
const TEST_UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

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
    // テスト用画像を作成
    const imageData = createTestImage('test.png');
    
    // FormDataを作成してファイルをアップロード
    const formData = new FormData();
    formData.append('image', new Blob([imageData], { type: 'image/png' }), 'test.png');

    const response = await request.post(`${BASE_URL}/api/upload`, {
      data: formData
    });

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
    const imageData = createTestImage('test.jpg');
    
    const formData = new FormData();
    formData.append('image', new Blob([imageData], { type: 'image/jpeg' }), 'test.jpg');

    const response = await request.post(`${BASE_URL}/api/upload`, {
      data: formData
    });

    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.filename).toMatch(/\.jpg$/);
  });

  test('異常系：ファイルなしでアップロード', async ({ request }) => {
    const formData = new FormData();
    // ファイルを追加しない

    const response = await request.post(`${BASE_URL}/api/upload`, {
      data: formData
    });

    expect(response.status()).toBe(400);
    
    const result = await response.json();
    expect(result).toHaveProperty('error', 'ファイルが選択されていません');
  });

  test('異常系：画像以外のファイルをアップロード', async ({ request }) => {
    const textData = Buffer.from('This is not an image file');
    
    const formData = new FormData();
    formData.append('image', new Blob([textData], { type: 'text/plain' }), 'test.txt');

    const response = await request.post(`${BASE_URL}/api/upload`, {
      data: formData
    });

    expect(response.status()).toBe(500);
    
    const result = await response.json();
    expect(result).toHaveProperty('error');
  });

  test('正常系：複数ファイルの連続アップロード', async ({ request }) => {
    const files = [
      { name: 'test1.png', data: createTestImage('test1.png') },
      { name: 'test2.jpg', data: createTestImage('test2.jpg') },
      { name: 'test3.png', data: createTestImage('test3.png') }
    ];

    const uploadedFiles = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('image', new Blob([file.data], { type: 'image/png' }), file.name);

      const response = await request.post(`${BASE_URL}/api/upload`, {
        data: formData
      });

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
    const imageData = createTestImage('test-access.png');
    
    const formData = new FormData();
    formData.append('image', new Blob([imageData], { type: 'image/png' }), 'test-access.png');

    const uploadResponse = await request.post(`${BASE_URL}/api/upload`, {
      data: formData
    });

    expect(uploadResponse.status()).toBe(200);
    
    const uploadResult = await uploadResponse.json();
    
    // アップロードされたファイルにアクセスできることを確認
    const fileResponse = await request.get(`${BASE_URL}${uploadResult.url}`);
    expect(fileResponse.status()).toBe(200);
    
    // レスポンスが画像データであることを確認
    const contentType = fileResponse.headers()['content-type'];
    expect(contentType).toMatch(/^image\//);
  });
});
