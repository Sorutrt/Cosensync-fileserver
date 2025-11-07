/**
 * テスト用ヘルパー関数
 * テスト全体で共通して使用するユーティリティ関数を定義
 */

import { test as base } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

// グローバルなサーバープロセス（全テストで共有）
let serverProcess: ChildProcess | null = null;

/**
 * テストサーバーを起動する
 * すでに起動している場合は何もしない
 * @returns サーバーが準備完了したときに解決するPromise
 */
export async function startTestServer(): Promise<void> {
  if (serverProcess) {
    return; // すでに起動している
  }

  return new Promise((resolve, reject) => {
    const port = process.env.PORT || '5050';
    
    // ts-nodeでサーバーを起動
    serverProcess = spawn('npx', ['ts-node', 'src/server.ts'], {
      env: { ...process.env, PORT: port },
      stdio: 'pipe',
      shell: true
    });

    let serverReady = false;

    // サーバーの出力を監視
    serverProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log('[Server]', output);
      
      // サーバーが起動完了したメッセージを検出
      if (output.includes('がポート') && output.includes('で起動しました')) {
        if (!serverReady) {
          serverReady = true;
          // 少し待ってから解決（サーバーが完全に準備できるまで）
          setTimeout(resolve, 500);
        }
      }
    });

    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[Server Error]', data.toString());
    });

    serverProcess.on('error', (error: Error) => {
      console.error('[Server Process Error]', error);
      reject(error);
    });

    serverProcess.on('exit', (code: number | null) => {
      console.log('[Server] Process exited with code', code);
      serverProcess = null;
    });

    // タイムアウト設定（10秒）
    setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Server startup timeout'));
      }
    }, 10000);
  });
}

/**
 * テストサーバーを停止する
 */
export async function stopTestServer(): Promise<void> {
  if (serverProcess) {
    return new Promise((resolve) => {
      serverProcess!.on('exit', () => {
        serverProcess = null;
        resolve();
      });
      
      // Windowsの場合はtaskkillを使用
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', serverProcess!.pid!.toString(), '/f', '/t']);
      } else {
        serverProcess!.kill();
      }
      
      // タイムアウト後に強制解決
      setTimeout(resolve, 2000);
    });
  }
}

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
 * 1x1ピクセルの最小PNGファイルを生成する
 * @param filename - ファイル名（実際には使用しない、将来の拡張用）
 * @param size - サイズ（実際には使用しない、将来の拡張用）
 * @returns PNG形式の画像データを含むBuffer
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
