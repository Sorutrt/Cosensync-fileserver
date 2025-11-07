/**
 * ファイル名抽出ロジックのユニットテスト
 * Cosenseバックアップから必要なファイル名を抽出する関数のテスト
 */

import { test, expect } from '@playwright/test';

// テスト対象の関数をインポート
import { extractFileNamesFromBackup } from '../src/file-utils';

test.describe('ファイル名抽出ユニットテスト', () => {
  
  test('正常系：標準的なCosenseバックアップからファイル名を抽出', () => {
    const backupData = {
      pages: [
        {
          lines: [
            { text: '[https://example.com/12345678-1234-1234-1234-123456789abc.jpg]' },
            { text: 'テキストのみの行' },
            { text: '[https://example.com/87654321-4321-4321-4321-cba987654321.png]' }
          ]
        },
        {
          lines: [
            { text: '[https://example.com/abcdef12-3456-7890-abcd-ef1234567890.gif]' }
          ]
        }
      ]
    };

    const result = extractFileNamesFromBackup(backupData);
    
    expect(result).toContain('12345678-1234-1234-1234-123456789abc.jpg');
    expect(result).toContain('87654321-4321-4321-4321-cba987654321.png');
    expect(result).toContain('abcdef12-3456-7890-abcd-ef1234567890.gif');
    expect(result.size).toBe(3);
  });

  test('正常系：複数のURL形式に対応', () => {
    const backupData = {
      pages: [
        {
          lines: [
            // 直接ファイル名のみ
            { text: '12345678-1234-1234-1234-123456789abc.jpg' },
            // マークダウンリンク形式
            { text: '[https://example.com/87654321-4321-4321-4321-cba987654321.png]' },
            // プレーンURL
            { text: 'https://example.com/abcdef12-3456-7890-abcd-ef1234567890.gif' },
            // 相対パス
            { text: '/uploads/11111111-1111-1111-1111-111111111111.webp' }
          ]
        }
      ]
    };

    const result = extractFileNamesFromBackup(backupData);
    
    expect(result.size).toBe(4);
  });

  test('正常系：同じファイル名が複数回出現する場合は重複排除', () => {
    const backupData = {
      pages: [
        {
          lines: [
            { text: '[https://example.com/12345678-1234-1234-1234-123456789abc.jpg]' },
            { text: '[https://example.com/12345678-1234-1234-1234-123456789abc.jpg]' },
            { text: '12345678-1234-1234-1234-123456789abc.jpg' }
          ]
        }
      ]
    };

    const result = extractFileNamesFromBackup(backupData);
    
    expect(result.size).toBe(1);
    expect(result).toContain('12345678-1234-1234-1234-123456789abc.jpg');
  });

  test('異常系：空のバックアップデータ', () => {
    const backupData = {
      pages: []
    };

    const result = extractFileNamesFromBackup(backupData);
    
    expect(result.size).toBe(0);
  });

  test('異常系：linesが存在しないページ', () => {
    const backupData = {
      pages: [
        {
          // linesプロパティがない
        }
      ]
    };

    const result = extractFileNamesFromBackup(backupData);
    
    expect(result.size).toBe(0);
  });

  test('異常系：textが存在しないline', () => {
    const backupData = {
      pages: [
        {
          lines: [
            { }, // textプロパティがない
            { text: null }, // textがnull
            { text: '' } // textが空文字列
          ]
        }
      ]
    };

    const result = extractFileNamesFromBackup(backupData);
    
    expect(result.size).toBe(0);
  });

  test('正常系：UUID形式でないファイル名は無視', () => {
    const backupData = {
      pages: [
        {
          lines: [
            { text: 'image.jpg' }, // UUID形式でない
            { text: '12345678-1234-1234-1234-123456789abc.jpg' }, // UUID形式
            { text: 'document.pdf' } // UUID形式でない
          ]
        }
      ]
    };

    const result = extractFileNamesFromBackup(backupData);
    
    expect(result.size).toBe(1);
    expect(result).toContain('12345678-1234-1234-1234-123456789abc.jpg');
  });
});

