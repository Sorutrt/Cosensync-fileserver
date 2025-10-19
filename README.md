# Cosensync Fileserver

Cosenseに貼り付ける画像専用のアップローダーシステムです。

## 特徴

- **セルフホスト型**: 著作権的にデリケートな画像を安全に管理
- **シンプル設計**: ファイル一覧機能は持たず、アップロード機能に特化
- **セキュリティ重視**: UUIDファイル名で推測困難なリンク生成
- **GC機能**: CosenseのバックアップJSONに基づく不要ファイルの自動削除

## 機能

### アップロード機能
- ドラッグ&ドロップ
- ファイル選択（OS規定のファイラー）
- クリップボードからの貼り付け
- 画像プレビュー表示
- UUIDファイル名による重複回避

### リンク管理
- 生成されたリンクの履歴表示（最大高さ内でスクロール可能）
- ワンクリックコピー機能（クリック即時で『✓』に切替）
- 行クリックでのコピー
- 直近で生成されたリンク行を数秒間ハイライト
- ブラウザ側での履歴管理（localStorage）

### GC（ガベージコレクション）機能
- CosenseのバックアップJSONファイル解析
- 不要ファイルの自動削除
- 削除結果の詳細表示

## セットアップ

### 前提条件
- Node.js 18+（推奨: 22.x）

### インストール

1. Node.jsのバージョン設定（miseで自動実行）
```bash
mise install
```

2. 依存関係のインストール
```bash
npm install
```

3. 開発サーバー起動（ホット実行）
```bash
npm run dev
```

### 本番ビルド/起動
```bash
npm run build
npm start
```

## 使用方法

1. ブラウザで `http://localhost:5050` にアクセス
2. 画像ファイルをドラッグ&ドロップまたはファイル選択
3. プレビューを確認してアップロード
4. 生成されたリンクをコピー（コピー直後はボタンが『✓』に変化）

### GC機能の使用

1. CosenseからバックアップJSONファイルをエクスポート
2. 「バックアップファイルを選択」ボタンでJSONファイルを選択
3. 「GC実行」ボタンで不要ファイルを削除

## 技術仕様

- **サーバー**: Node.js + TypeScript + Express
- **ポート**: 5050（デフォルト、`PORT`で上書き可）
- **ストレージ**: ローカルディスク（uploadsディレクトリ）
- **ファイル形式**: 画像ファイル（拡張子制限なし）
- **ファイルサイズ**: 制限なし

## ディレクトリ構造

```
cosensync-fileserver/
├── src/
│   └── server.ts          # メインサーバーファイル
├── public/
│   ├── index.html         # メインHTML
│   ├── style.css          # スタイルシート
│   └── script.js          # フロントエンドJavaScript
│       └─ UI仕様: ダイアログ非表示、行ハイライト、コピー時✓
├── uploads/               # アップロードファイル保存先
├── dist/                  # ビルド出力先
├── package.json
├── tsconfig.json
└── README.md
```

## 環境変数

- `PORT`: サーバーポート（デフォルト: 5050）

## Cloudflare Tunnel 公開（任意）

1. cloudflared をインストールし認証
2. トンネル作成: `cloudflared tunnel create cosensync-fileserver`
3. `~/.cloudflared/config.yml`
    - `ingress.hostname`: 例) `fileserver.yourdomain.com`
    - `service`: `http://localhost:5050`
4. DNSに `CNAME: fileserver -> <tunnel-id>.cfargotunnel.com`
5. 起動: `cloudflared tunnel run cosensync-fileserver`

## セキュリティ

- 画像ファイルのみアップロード可能
- UUIDファイル名による推測困難なリンク
- ローカルストレージによる履歴管理
- パスワード認証なし（仕様による）

## ライセンス

MIT License
