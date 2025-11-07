import { test, expect } from '@playwright/test';

test('Cosensync Fileserver 基本動作テスト', async ({ page }) => {
	await page.goto('http://localhost:5050');
	
	// ページタイトルの確認
	await expect(page).toHaveTitle(/Cosensync Fileserver/);
	
	// メインコンテンツの確認
	await expect(page.locator('h1')).toContainText('Cosensync Fileserver');
	await expect(page.locator('p')).toContainText('画像ファイルをアップロードしてリンクを生成');
	
	// アップロードエリアの確認
	await expect(page.locator('#dropZone')).toBeVisible();
	await expect(page.locator('#fileSelectBtn')).toBeVisible();
	
	// リンク履歴セクションの確認
	await expect(page.locator('.history-section h3')).toContainText('生成されたリンク');
	
	// GCセクションの確認
	await expect(page.locator('.gc-section h3')).toContainText('ガベージコレクション');
});
