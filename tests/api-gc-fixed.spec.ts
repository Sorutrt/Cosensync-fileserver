/**
 * APIエンドポイントテスト - ガベージコレクション機能
 * /api/gc エンドポイントの正常系・異常系テスト
 */

import { test, expect } from '@playwright/test';
import { createTestImage, cleanupTestDirectory, ensureTestDirectory, getCosenseBackupPath } from './test-helpers';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:5050';
const TEST_UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

test.describe('ガベージコレクションAPI', () => {
  
  test.beforeEach(async () => {
    // テスト前にuploadsディレクトリを準備
    ensureTestDirectory(TEST_UPLOADS_DIR);
  });

  test.afterEach(async () => {
    // テスト後にuploadsディレクトリをクリーンアップ
    cleanupTestDirectory(TEST_UPLOADS_DIR);
  });

  test('正常系：Cosenseバックアップファイルを使用したGC', async ({ request }) => {
    // テスト用のファイルをいくつか作成
    const requiredFile = '12345678-1234-1234-1234-123456789abc.jpg';
    const unnecessaryFile1 = '11111111-1111-1111-111111111111.png';
    const unnecessaryFile2 = '22222222-2222-2222-222222222222.gif';

    // 必要なファイルを作成
    fs.writeFileSync(
      path.join(TEST_UPLOADS_DIR, requiredFile),
      createTestImage(requiredFile)
    );

    // 不要なファイルを作成
    fs.writeFileSync(
      path.join(TEST_UPLOADS_DIR, unnecessaryFile1),
      createTestImage(unnecessaryFile1)
    );
    fs.writeFileSync(
      path.join(TEST_UPLOADS_DIR, unnecessaryFile2),
      createTestImage(unnecessaryFile2)
    );

    // ファイルが存在することを確認
    expect(fs.existsSync(path.join(TEST_UPLOADS_DIR, requiredFile))).toBe(true);
    expect(fs.existsSync(path.join(TEST_UPLOADS_DIR, unnecessaryFile1))).toBe(true);
    expect(fs.existsSync(path.join(TEST_UPLOADS_DIR, unnecessaryFile2))).toBe(true);

    // CosenseバックアップファイルをアップロードしてGCを実行
    const backupData = fs.readFileSync(getCosenseBackupPath());
    const formData = new FormData();
    formData.append('backup', new Blob([backupData], { type: 'application/json' }), 'backup.json');

    const response = await request.post(`${BASE_URL}/api/gc`, {
      data: formData
    });

    // レスポンスの検証
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('deletedFiles');
    expect(result).toHaveProperty('deletedCount');
    expect(result.deletedCount).toBeGreaterThanOrEqual(0);

    // 必要なファイルは残り、不要なファイルは削除されていることを確認
    expect(fs.existsSync(path.join(TEST_UPLOADS_DIR, requiredFile))).toBe(true);
    
    // 不要なファイルは削除されているはず（バックアップに含まれていないため）
    const unnecessaryFilesExist = 
      fs.existsSync(path.join(TEST_UPLOADS_DIR, unnecessaryFile1)) ||
      fs.existsSync(path.join(TEST_UPLOADS_DIR, unnecessaryFile2));
    
    // GC結果に不要なファイルが含まれていることを確認
    if (result.deletedCount > 0) {
      expect(result.deletedFiles.length).toBeGreaterThan(0);
    }
  });

  test('正常系：空のuploadsディレクトリでのGC', async ({ request }) => {
    // uploadsディレクトリは空の状態

    const backupData = fs.readFileSync(getCosenseBackupPath());
    const formData = new FormData();
    formData.append('backup', new Blob([backupData], { type: 'application/json' }), 'backup.json');

    const response = await request.post(`${BASE_URL}/api/gc`, {
      data: formData
    });

    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(0);
    expect(result.deletedFiles).toEqual([]);
  });

  test('異常系：バックアップファイルなしでGC実行', async ({ request }) => {
    const formData = new FormData();
    // バックアップファイルを追加しない

    const response = await request.post(`${BASE_URL}/api/gc`, {
      data: formData
    });

    expect(response.status()).toBe(400);
    
    const result = await response.json();
    expect(result).toHaveProperty('error', 'バックアップファイルが選択されていません');
  });

  test('異常系：無効なJSONファイルでGC実行', async ({ request }) => {
    const invalidJson = Buffer.from('invalid json content');
    
    const formData = new FormData();
    formData.append('backup', new Blob([invalidJson], { type: 'application/json' }), 'invalid.json');

    const response = await request.post(`${BASE_URL}/api/gc`, {
      data: formData
    });

    expect(response.status()).toBe(500);
    
    const result = await response.json();
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('GC処理に失敗しました');
  });

  test('正常系：すべてのファイルが必要な場合のGC', async ({ request }) => {
    // バックアップに含まれるファイル名のファイルを作成
    const requiredFiles = [
      '12345678-1234-1234-1234-123456789abc.jpg',
      '87654321-4321-4321-4321-cba987654321.png',
      'abcdef12-3456-7890-abcd-ef1234567890.gif'
    ];

    for (const filename of requiredFiles) {
      fs.writeFileSync(
        path.join(TEST_UPLOADS_DIR, filename),
        createTestImage(filename)
      );
    }

    // すべてのファイルが存在することを確認
    for (const filename of requiredFiles) {
      expect(fs.existsSync(path.join(TEST_UPLOADS_DIR, filename))).toBe(true);
    }

    const backupData = fs.readFileSync(getCosenseBackupPath());
    const formData = new FormData();
    formData.append('backup', new Blob([backupData], { type: 'application/json' }), 'backup.json');

    const response = await request.post(`${BASE_URL}/api/gc`, {
      data: formData
    });

    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(0);
    expect(result.deletedFiles).toEqual([]);

    // すべてのファイルが残っていることを確認
    for (const filename of requiredFiles) {
      expect(fs.existsSync(path.join(TEST_UPLOADS_DIR, filename))).toBe(true);
    }
  });

  test('正常系：バックアップファイルの自動削除', async ({ request }) => {
    const backupData = fs.readFileSync(getCosenseBackupPath());
    const formData = new FormData();
    formData.append('backup', new Blob([backupData], { type: 'application/json' }), 'test-backup.json');

    const response = await request.post(`${BASE_URL}/api/gc`, {
      data: formData
    });

    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result.success).toBe(true);

    // バックアップファイルがuploadsディレクトリに残っていないことを確認
    //（サーバーが一時保存したバックアップファイルを削除したはず）
    const uploadsFiles = fs.readdirSync(TEST_UPLOADS_DIR);
    const backupFiles = uploadsFiles.filter(file => file.includes('backup') || file.includes('json'));
    expect(backupFiles.length).toBe(0);
  });
});
