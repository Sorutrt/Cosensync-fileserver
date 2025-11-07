import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { extractFileNamesFromBackup, identifyUnnecessaryFiles } from './file-utils';

const app = express();
const PORT = process.env.PORT || 5050;

/**
 * ミドルウェア設定
 * CORS、JSON解析、静的ファイル配信を有効化
 */
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

/**
 * アップロードディレクトリの初期化
 * 存在しない場合は自動的に作成する
 */
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Multer設定 - ファイルアップロード処理
 * ファイル名はUUID形式で保存し、元の拡張子を保持する
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // 元の拡張子を保持してUUIDファイル名を生成
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

/**
 * Multerインスタンス - アップロード設定
 * 画像ファイルのみを許可し、それ以外はエラーとする
 */
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // 画像ファイルのみ許可
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('画像ファイルのみアップロード可能です'));
    }
  }
});

/**
 * ファイルアップロードAPIエンドポイント
 * 画像ファイルをUUIDファイル名で保存し、アクセス用のURLを返す
 * 
 * @route POST /api/upload
 * @param {File} image - アップロードする画像ファイル（multipart/form-data）
 * @returns {Object} success - 成功フラグ、url - アクセス用URL、filename - 保存されたファイル名
 */
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    // ファイルの存在確認
    if (!req.file) {
      console.warn('ファイルアップロードリクエストにファイルが含まれていません');
      return res.status(400).json({ error: 'ファイルが選択されていません' });
    }

    // アクセス用URLの生成
    const fileUrl = `/uploads/${req.file.filename}`;
    const fullUrl = `${req.protocol}://${req.get('host')}${fileUrl}`;
    
    console.log(`ファイルアップロード成功: ${req.file.filename}`);
    
    res.json({ 
      success: true, 
      url: fullUrl,
      filename: req.file.filename 
    });
  } catch (error) {
    console.error('アップロードエラー:', error);
    res.status(500).json({ 
      error: 'アップロードに失敗しました',
      details: error instanceof Error ? error.message : '不明なエラー'
    });
  }
});

/**
 * GC（ガベージコレクション）APIエンドポイント
 * CosenseのバックアップJSONを解析し、参照されていないファイルを削除する
 * 
 * @route POST /api/gc
 * @param {File} backup - CosenseのバックアップJSONファイル（multipart/form-data）
 * @returns {Object} success - 成功フラグ、deletedFiles - 削除されたファイル名の配列、deletedCount - 削除数
 */
app.post('/api/gc', upload.single('backup'), async (req, res) => {
  let backupPath: string | undefined;
  
  try {
    // バックアップファイルの存在確認
    if (!req.file) {
      console.warn('GCリクエストにバックアップファイルが含まれていません');
      return res.status(400).json({ error: 'バックアップファイルが選択されていません' });
    }

    backupPath = req.file.path;
    
    // JSONファイルを読み込みとパース
    let backupData;
    try {
      const backupContent = fs.readFileSync(backupPath, 'utf8');
      backupData = JSON.parse(backupContent);
    } catch (parseError) {
      console.error('バックアップJSONのパースに失敗:', parseError);
      return res.status(400).json({ 
        error: 'バックアップファイルの形式が不正です',
        details: parseError instanceof Error ? parseError.message : '不明なエラー'
      });
    }
    
    // 必要なファイル名を収集（モジュール化された関数を使用）
    const requiredFiles = extractFileNamesFromBackup(backupData);
    console.log(`必要なファイル数: ${requiredFiles.size}`);

    // uploadsディレクトリ内のファイルをチェック
    const uploadedFiles = fs.readdirSync(uploadsDir);
    console.log(`アップロード済みファイル数: ${uploadedFiles.length}`);
    
    // 不要なファイルを特定（モジュール化された関数を使用）
    const unnecessaryFiles = identifyUnnecessaryFiles(uploadedFiles, requiredFiles);
    console.log(`削除対象ファイル数: ${unnecessaryFiles.length}`);
    
    // 不要なファイルを削除
    const deletedFiles = deleteFiles(uploadsDir, unnecessaryFiles);

    console.log(`GC処理完了: ${deletedFiles.length}個のファイルを削除しました`);

    res.json({ 
      success: true, 
      deletedFiles: deletedFiles,
      deletedCount: deletedFiles.length 
    });
  } catch (error) {
    console.error('GC処理エラー:', error);
    res.status(500).json({ 
      error: 'GC処理に失敗しました',
      details: error instanceof Error ? error.message : '不明なエラー'
    });
  } finally {
    // バックアップファイルのクリーンアップ（成功・失敗に関わらず）
    if (backupPath && fs.existsSync(backupPath)) {
      try {
        fs.unlinkSync(backupPath);
        console.log('バックアップファイルを削除しました');
      } catch (cleanupError) {
        console.error('バックアップファイルの削除に失敗:', cleanupError);
      }
    }
  }
});

/**
 * 指定されたファイルリストを削除する
 * 
 * @param directory - ファイルが存在するディレクトリ
 * @param fileNames - 削除するファイル名の配列
 * @returns 実際に削除されたファイル名の配列
 */
function deleteFiles(directory: string, fileNames: string[]): string[] {
  const deletedFiles: string[] = [];
  
  fileNames.forEach(file => {
    const filePath = path.join(directory, file);
    try {
      fs.unlinkSync(filePath);
      deletedFiles.push(file);
    } catch (error) {
      console.error(`ファイル削除エラー: ${file}`, error);
    }
  });
  
  return deletedFiles;
}

/**
 * サーバー起動
 * 指定されたポートでExpressサーバーを起動する
 */
app.listen(PORT, () => {
  console.log(`Cosensync-fileserver がポート ${PORT} で起動しました`);
  console.log(`http://localhost:${PORT} でアクセスできます`);
});


