/**
 * E2Eテスト - ファイルアップロード機能のUI操作
 * ブラウザを使用したエンドツーエンドのテスト
 */

import { test, expect } from '@playwright/test';
import { cleanupTestDirectory, ensureTestDirectory } from './test-helpers';
import path from 'path';

const BASE_URL = 'http://localhost:5050';
const TEST_UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

test.describe('E2E ファイルアップロード', () => {
  
  test.beforeEach(async ({ page }) => {
    // テスト前にuploadsディレクトリを準備
    ensureTestDirectory(TEST_UPLOADS_DIR);
    
    // ページにアクセス
    await page.goto(BASE_URL);
    
    // ページが読み込まれるまで待機
    await page.waitForSelector('h1');
  });

  test.afterEach(async () => {
    // テスト後にuploadsディレクトリをクリーンアップ
    cleanupTestDirectory(TEST_UPLOADS_DIR);
  });

  test('ページの基本要素が表示される', async ({ page }) => {
    // タイトルの確認
    await expect(page.locator('h1')).toContainText('Cosensync Fileserver');
    
    // アップロードエリアの確認
    await expect(page.locator('#dropZone')).toBeVisible();
    await expect(page.locator('#fileSelectBtn')).toBeVisible();
    await expect(page.locator('#fileInput')).toBeAttached();
    
    // リンク履歴セクションの確認
    await expect(page.locator('.history-section h3')).toContainText('生成されたリンク');
    
    // GCセクションの確認
    await expect(page.locator('.gc-section h3')).toContainText('ガベージコレクション');
  });

  test('ファイル選択ボタンで画像をアップロード', async ({ page }) => {
    // テスト用画像ファイルのパスを準備
    const testImagePath = path.join(__dirname, 'fixtures', 'test-image.png');
    
    // テスト用画像ファイルを作成（簡易的なPNG）
    const fs = require('fs');
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
    
    // fixturesディレクトリを作成
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir);
    }
    fs.writeFileSync(testImagePath, testImageBuffer);

    try {
      // ファイル選択
      await page.setInputFiles('#fileInput', testImagePath);
      
      // プレビューが表示されるまで待機
      await expect(page.locator('#previewArea')).toBeVisible();
      await expect(page.locator('.preview-image img')).toBeVisible();
      
      // アップロードが完了するまで待機（少し待機時間を設ける）
      await page.waitForTimeout(2000);
      
      // リンク履歴に追加されていることを確認
      await expect(page.locator('.link-item')).toHaveCount(1);
      const linkItem = page.locator('.link-item').first();
      await expect(linkItem.locator('.link-url')).toContainText('/uploads/');
      
    } finally {
      // テスト後にファイルをクリーンアップ
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    }
  });

  test('ドラッグ＆ドロップで画像をアップロード', async ({ page }) => {
    // テスト用画像ファイルのパスを準備
    const testImagePath = path.join(__dirname, 'fixtures', 'test-drag.png');
    
    const fs = require('fs');
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
    
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir);
    }
    fs.writeFileSync(testImagePath, testImageBuffer);

    try {
      // ドラッグ＆ドロップ
      const dropZone = page.locator('#dropZone');
      await dropZone.dragAndDrop(testImagePath, '#dropZone');
      
      // ドラッグオーバー効果が表示されることを確認
      await expect(dropZone).toHaveClass(/dragover/);
      
      // プレビューが表示されるまで待機
      await expect(page.locator('#previewArea')).toBeVisible();
      
      // アップロード完了を待機
      await page.waitForTimeout(2000);
      
      // リンク履歴に追加されていることを確認
      await expect(page.locator('.link-item')).toHaveCount(1);
      
    } finally {
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    }
  });

  test('リンク履歴のコピー機能', async ({ page }) => {
    // まず画像をアップロードしてリンクを生成
    const testImagePath = path.join(__dirname, 'fixtures', 'test-copy.png');
    
    const fs = require('fs');
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
    
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir);
    }
    fs.writeFileSync(testImagePath, testImageBuffer);

    try {
      // ファイルをアップロード
      await page.setInputFiles('#fileInput', testImagePath);
      await page.waitForTimeout(2000);
      
      // リンク項目が表示されるのを確認
      const linkItem = page.locator('.link-item').first();
      await expect(linkItem).toBeVisible();
      
      // コピーボタンをクリック
      const copyBtn = linkItem.locator('.copy-btn');
      await copyBtn.click();
      
      // コピー完了の表示を確認
      await expect(copyBtn).toHaveText('✓');
      await expect(copyBtn).toHaveClass(/copied/);
      
      // 少し待ってから元に戻ることを確認
      await page.waitForTimeout(3000);
      await expect(copyBtn).toHaveText('コピー');
      await expect(copyBtn).not.toHaveClass(/copied/);
      
    } finally {
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    }
  });

  test('GC機能のUI操作', async ({ page }) => {
    // GCセクションの要素を確認
    await expect(page.locator('#gcSelectBtn')).toBeVisible();
    await expect(page.locator('#gcFileInput')).toBeAttached();
    
    // テスト用バックアップファイルのパス
    const backupPath = path.join(__dirname, 'cosense-backup.json');
    
    // バックアップファイルを選択
    await page.setInputFiles('#gcFileInput', backupPath);
    
    // GC実行ボタンが表示されることを確認
    await expect(page.locator('#gcExecuteBtn')).toBeVisible();
    
    // GC実行ボタンをクリック
    await page.locator('#gcExecuteBtn').click();
    
    // GC結果が表示されるまで待機
    await expect(page.locator('#gcResult')).toBeVisible();
    await expect(page.locator('.gc-result')).toContainText('GC処理が完了しました');
  });

  test('複数ファイルのアップロード', async ({ page }) => {
    // 複数のテスト画像ファイルを準備
    const testFiles = ['test1.png', 'test2.png', 'test3.png'];
    const testPaths = [];
    
    const fs = require('fs');
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
    
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir);
    }
    
    try {
      // テストファイルを作成
      for (const filename of testFiles) {
        const filePath = path.join(fixturesDir, filename);
        fs.writeFileSync(filePath, testImageBuffer);
        testPaths.push(filePath);
      }
      
      // 複数ファイルを選択
      await page.setInputFiles('#fileInput', testPaths);
      
      // プレビューに複数の画像が表示されることを確認
      await expect(page.locator('#previewArea')).toBeVisible();
      await expect(page.locator('.preview-image')).toHaveCount(testFiles.length);
      
      // アップロード完了を待機
      await page.waitForTimeout(3000);
      
      // リンク履歴に複数のリンクが追加されていることを確認
      await expect(page.locator('.link-item')).toHaveCount(testFiles.length);
      
    } finally {
      // テスト後にファイルをクリーンアップ
      for (const filePath of testPaths) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }
  });
});
