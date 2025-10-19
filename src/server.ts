import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 5050;

// ミドルウェア設定
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// uploadsディレクトリが存在しない場合は作成
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer設定 - UUIDファイル名で保存
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
 * ファイルアップロード処理
 * 画像ファイルをUUIDファイル名で保存し、アクセス用のURLを返す
 */
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルが選択されていません' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const fullUrl = `${req.protocol}://${req.get('host')}${fileUrl}`;
    
    res.json({ 
      success: true, 
      url: fullUrl,
      filename: req.file.filename 
    });
  } catch (error) {
    console.error('アップロードエラー:', error);
    res.status(500).json({ error: 'アップロードに失敗しました' });
  }
});

/**
 * GC（ガベージコレクション）処理
 * CosenseのバックアップJSONを解析し、不要なファイルを削除
 */
app.post('/api/gc', upload.single('backup'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'バックアップファイルが選択されていません' });
    }

    // JSONファイルを読み込み
    const backupPath = req.file.path;
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    // 必要なファイル名を収集
    const requiredFiles = new Set<string>();
    
    if (backupData.pages && Array.isArray(backupData.pages)) {
      backupData.pages.forEach((page: any) => {
        if (page.lines && Array.isArray(page.lines)) {
          page.lines.forEach((line: any) => {
            if (line.text && typeof line.text === 'string') {
              // テキスト内からファイル名を抽出（URL形式やファイル名パターンを検索）
              const text = line.text;
              // 簡単なファイル名パターンマッチング
              const fileMatches = text.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-zA-Z0-9]+/g);
              if (fileMatches) {
                fileMatches.forEach((match: string) => requiredFiles.add(match));
              }
            }
          });
        }
      });
    }

    // uploadsディレクトリ内のファイルをチェック
    const uploadedFiles = fs.readdirSync(uploadsDir);
    const deletedFiles: string[] = [];
    
    uploadedFiles.forEach(file => {
      if (!requiredFiles.has(file)) {
        const filePath = path.join(uploadsDir, file);
        try {
          fs.unlinkSync(filePath);
          deletedFiles.push(file);
        } catch (error) {
          console.error(`ファイル削除エラー: ${file}`, error);
        }
      }
    });

    // バックアップファイルも削除
    fs.unlinkSync(backupPath);

    res.json({ 
      success: true, 
      deletedFiles: deletedFiles,
      deletedCount: deletedFiles.length 
    });
  } catch (error) {
    console.error('GC処理エラー:', error);
    res.status(500).json({ error: 'GC処理に失敗しました' });
  }
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Cosensync-fileserver がポート ${PORT} で起動しました`);
  console.log(`http://localhost:${PORT} でアクセスできます`);
});


