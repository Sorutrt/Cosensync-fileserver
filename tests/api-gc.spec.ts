/**
 * APIエンドポイントテスト - ガベージコレクション機能
 * /api/gc エンドポイントの正常系・異常系テスト
 */

import { test, expect } from '@playwright/test';
import { createTestImage, cleanupTestDirectory, ensureTestDirectory, getCosenseBackupPath } from './test-helpers';
import path from 'path';
import fs from 'fs';

const BASE_URL = `http://localhost:${process.env.PORT || 5050}`;
const TEST_UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const GC_TEMP_DIR = path.join(TEST_UPLOADS_DIR, '.gc-tmp');
const BACKUP_FILE_PATTERN = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-zA-Z0-9]+/g;

function getBackupData(): Buffer {
  return fs.readFileSync(getCosenseBackupPath());
}

function getReferencedFilesFromBackup(): string[] {
  const backupText = getBackupData().toString('utf8');
  return [...new Set(backupText.match(BACKUP_FILE_PATTERN) || [])];
}

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
    const [requiredFile] = getReferencedFilesFromBackup();
    const unnecessaryFile1 = '11111111-1111-1111-1111-111111111111.png';
    const unnecessaryFile2 = '22222222-2222-2222-2222-222222222222.gif';

    expect(requiredFile).toBeTruthy();

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
    const backupData = getBackupData();
    const response = await request.post(`${BASE_URL}/api/gc`, {
      multipart: {
        backup: {
          name: 'backup.json',
          mimeType: 'application/json',
          buffer: backupData
        }
      }
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

    expect(fs.existsSync(path.join(TEST_UPLOADS_DIR, unnecessaryFile1))).toBe(false);
    expect(fs.existsSync(path.join(TEST_UPLOADS_DIR, unnecessaryFile2))).toBe(false);
    expect(result.deletedCount).toBe(2);
    expect(result.deletedFiles).toEqual(expect.arrayContaining([unnecessaryFile1, unnecessaryFile2]));
  });

  test('正常系：空のuploadsディレクトリでのGC', async ({ request }) => {
    // uploadsディレクトリは空の状態

    const backupData = getBackupData();
    const response = await request.post(`${BASE_URL}/api/gc`, {
      multipart: {
        backup: {
          name: 'backup.json',
          mimeType: 'application/json',
          buffer: backupData
        }
      }
    });

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(0);
    expect(result.deletedFiles).toEqual([]);
  });

  test('異常系：バックアップファイルなしでGC実行', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/gc`, {
      multipart: {}
    });

    expect(response.status()).toBe(400);

    const result = await response.json();
    expect(result).toHaveProperty('error', 'バックアップファイルが選択されていません');
  });

  test('異常系：無効なJSONファイルでGC実行', async ({ request }) => {
    const invalidJson = Buffer.from('invalid json content');

    const response = await request.post(`${BASE_URL}/api/gc`, {
      multipart: {
        backup: {
          name: 'invalid.json',
          mimeType: 'application/json',
          buffer: invalidJson
        }
      }
    });

    expect(response.status()).toBe(400);

    const result = await response.json();
    expect(result).toHaveProperty('error', 'バックアップファイルの形式が不正です');
  });

  test('異常系：CosenseバックアップではないJSONでは既存ファイルを削除しない', async ({ request }) => {
    const existingFile = '33333333-3333-3333-3333-333333333333.png';
    fs.writeFileSync(
      path.join(TEST_UPLOADS_DIR, existingFile),
      createTestImage(existingFile)
    );

    const response = await request.post(`${BASE_URL}/api/gc`, {
      multipart: {
        backup: {
          name: 'not-cosense.json',
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify({ data: [] }))
        }
      }
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toHaveProperty('error', 'Cosenseバックアップの構造が不正です');
    expect(fs.existsSync(path.join(TEST_UPLOADS_DIR, existingFile))).toBe(true);
  });

  test('異常系：HTMLファイルでGC実行', async ({ request }) => {
    const html = Buffer.from('<!doctype html><html><body>not json</body></html>');

    const response = await request.post(`${BASE_URL}/api/gc`, {
      multipart: {
        backup: {
          name: 'backup.json',
          mimeType: 'application/json',
          buffer: html
        }
      }
    });

    expect(response.status()).toBe(400);

    const result = await response.json();
    expect(result).toHaveProperty('error', 'バックアップファイルの形式が不正です');
    expect(result.details).toContain('JSONではなくHTML');
  });

  test('正常系：すべてのファイルが必要な場合のGC', async ({ request }) => {
    // バックアップに含まれるファイル名のファイルを作成
    const requiredFiles = getReferencedFilesFromBackup();
    expect(requiredFiles.length).toBeGreaterThan(0);

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

    const backupData = getBackupData();
    const response = await request.post(`${BASE_URL}/api/gc`, {
      multipart: {
        backup: {
          name: 'backup.json',
          mimeType: 'application/json',
          buffer: backupData
        }
      }
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
    const backupData = getBackupData();
    const response = await request.post(`${BASE_URL}/api/gc`, {
      multipart: {
        backup: {
          name: 'test-backup.json',
          mimeType: 'application/json',
          buffer: backupData
        }
      }
    });

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);

    // サーバーが一時保存したバックアップファイルが.gc-tmpに残っていないことを確認
    expect(fs.existsSync(GC_TEMP_DIR)).toBe(true);
    expect(fs.readdirSync(GC_TEMP_DIR)).toEqual([]);
  });
});
