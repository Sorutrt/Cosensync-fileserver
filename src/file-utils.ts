/**
 * ファイル処理に関するユーティリティ関数
 */

/**
 * Cosenseバックアップデータから必要なファイル名を抽出する
 * UUID形式（8-4-4-4-12桁のハイフン区切り）のファイル名のみを対象とする
 * 
 * @param backupData - Cosenseのバックアップデータ（JSON）
 * @returns 抽出されたファイル名のSet（重複なし）
 */
export function extractFileNamesFromBackup(backupData: any): Set<string> {
  const fileNames = new Set<string>();
  
  // バックアップデータの構造検証
  if (!backupData || !backupData.pages || !Array.isArray(backupData.pages)) {
    return fileNames;
  }

  // UUID形式のファイル名パターン（拡張子付き）
  // 形式: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.ext
  const filePattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-zA-Z0-9]+/g;

  // 各ページを走査
  backupData.pages.forEach((page: any) => {
    // linesプロパティの存在確認
    if (!page.lines || !Array.isArray(page.lines)) {
      return;
    }

    // 各行を走査
    page.lines.forEach((line: any) => {
      // 現在のエクスポートは文字列、旧形式はtextプロパティを持つオブジェクト
      const text = typeof line === 'string' ? line : line?.text;
      if (typeof text !== 'string' || !text) {
        return;
      }

      // テキスト内からファイル名を抽出
      const matches = text.match(filePattern);
      if (matches) {
        matches.forEach((match: string) => {
          fileNames.add(match);
        });
      }
    });
  });

  return fileNames;
}

/**
 * GCを安全に実行できるCosenseバックアップ構造か検証する
 */
export function isCosenseBackup(backupData: any): boolean {
  if (!backupData || !Array.isArray(backupData.pages)) {
    return false;
  }

  return backupData.pages.every((page: any) =>
    page &&
    Array.isArray(page.lines) &&
    page.lines.every((line: any) =>
      typeof line === 'string' || typeof line?.text === 'string'
    )
  );
}

/**
 * 指定されたディレクトリ内の不要なファイルを特定する
 * 
 * @param uploadedFiles - アップロードディレクトリ内の全ファイル名の配列
 * @param requiredFiles - 必要なファイル名のSet
 * @returns 削除すべきファイル名の配列
 */
export function identifyUnnecessaryFiles(
  uploadedFiles: string[],
  requiredFiles: Set<string>
): string[] {
  return uploadedFiles.filter(file => !requiredFiles.has(file));
}

