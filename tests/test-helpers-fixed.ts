/**
 * テスト用ヘルパー関数
 * テスト全体で共通して使用するユーティリティ関数を定義
 */

import { test as base } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// テスト用の拡張ベース
export const test = base.extend({
  // テスト前にサーバーを起動する拡張
  server: [async ({}, use) => {
    // サーバープロセスを起動（必要に応じて実装）
    await use({});
  }, { scope: 'test' }],
});

/**
 * テスト用画像ファイルのパスを取得
 */
export function getTestImagePath(filename: string): string {
  return path.join(__dirname, 'fixtures', filename);
}

/**
 * テスト用画像ファイルを作成
 */
export function createTestImage(filename: string, size: number = 1024): Buffer {
  // 簡単な1x1ピクセルのPNG画像を作成
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNGシグネチャ
    0x00, 0x00, 0x00, 0x0D, // IHDRチャンク長
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // 幅: 1
    0x00, 0x00, 0x00, 0x01, // 高さ: 1
    0x08, 0x02, 0x00, 0x00, 0x00, // ビット深度、カラータイプなど
    0x90, 0x77, 0x53, 0xDE, // CRC
    0x00, 0x00, 0x00, 0x0C, // IDATチャンク長
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 圧縮データ
    0x00, 0x00, 0x00, 0x00, // IENDチャンク長
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);
  return pngHeader;
}

/**
 * テスト用ディレクトリをクリーンアップ
 */
export function cleanupTestDirectory(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * テスト用ディレクトリを作成
 */
export function ensureTestDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * テスト用Cosenseバックアップファイルのパスを取得
 */
export function getCosenseBackupPath(): string {
  return path.join(__dirname, 'cosense-backup.json');
}
