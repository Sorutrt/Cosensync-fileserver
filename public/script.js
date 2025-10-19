/**
 * Cosensync Fileserver - フロントエンドJavaScript
 * ファイルアップロード、プレビュー、リンク履歴管理、GC機能を提供
 */

class FileUploader {
    constructor() {
        this.selectedFiles = [];
        this.linkHistory = this.loadLinkHistory();
        this.initializeElements();
        this.bindEvents();
        this.renderLinkHistory();
    }

    /**
     * DOM要素の初期化
     */
    initializeElements() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.fileSelectBtn = document.getElementById('fileSelectBtn');
        this.previewArea = document.getElementById('previewArea');
        this.previewImages = document.getElementById('previewImages');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
        this.linkHistory = document.getElementById('linkHistory');
        this.gcFileInput = document.getElementById('gcFileInput');
        this.gcSelectBtn = document.getElementById('gcSelectBtn');
        this.gcExecuteBtn = document.getElementById('gcExecuteBtn');
        this.gcResult = document.getElementById('gcResult');
    }

    /**
     * イベントリスナーの設定
     */
    bindEvents() {
        // ファイル選択
        this.fileSelectBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));

        // ドラッグ&ドロップ
        this.dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.dropZone.addEventListener('drop', (e) => this.handleDrop(e));

        // アップロード・キャンセル
        this.uploadBtn.addEventListener('click', () => this.uploadFiles());
        this.cancelBtn.addEventListener('click', () => this.cancelUpload());

        // クリップボード貼り付け
        document.addEventListener('paste', (e) => this.handlePaste(e));

        // GC機能
        this.gcSelectBtn.addEventListener('click', () => this.gcFileInput.click());
        this.gcFileInput.addEventListener('change', (e) => this.handleGcFileSelect(e.target.files));
        this.gcExecuteBtn.addEventListener('click', () => this.executeGC());
    }

    /**
     * ドラッグオーバー処理
     */
    handleDragOver(e) {
        e.preventDefault();
        this.dropZone.classList.add('dragover');
    }

    /**
     * ドラッグリーブ処理
     */
    handleDragLeave(e) {
        e.preventDefault();
        this.dropZone.classList.remove('dragover');
    }

    /**
     * ドロップ処理
     */
    handleDrop(e) {
        e.preventDefault();
        this.dropZone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
        this.handleFileSelect(files);
    }

    /**
     * ファイル選択処理
     */
    handleFileSelect(files) {
        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (imageFiles.length === 0) {
            alert('画像ファイルを選択してください');
            return;
        }
        
        this.selectedFiles = imageFiles;
        this.showPreview();
    }

    /**
     * クリップボード貼り付け処理
     */
    handlePaste(e) {
        const items = Array.from(e.clipboardData.items);
        const imageItems = items.filter(item => item.type.startsWith('image/'));
        
        if (imageItems.length > 0) {
            const files = imageItems.map(item => item.getAsFile());
            this.handleFileSelect(files);
        }
    }

    /**
     * プレビュー表示
     */
    showPreview() {
        this.previewImages.innerHTML = '';
        
        this.selectedFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewDiv = document.createElement('div');
                previewDiv.className = 'preview-image';
                previewDiv.innerHTML = `
                    <img src="${e.target.result}" alt="プレビュー">
                    <div class="filename">${file.name}</div>
                `;
                this.previewImages.appendChild(previewDiv);
            };
            reader.readAsDataURL(file);
        });
        
        this.previewArea.style.display = 'block';
    }

    /**
     * ファイルアップロード
     */
    async uploadFiles() {
        if (this.selectedFiles.length === 0) return;

        this.uploadBtn.disabled = true;
        this.uploadBtn.textContent = 'アップロード中...';

        try {
            const formData = new FormData();
            this.selectedFiles.forEach(file => {
                formData.append('image', file);
            });

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.addToLinkHistory(result.url);
                this.cancelUpload();
                // アップロード完了時のハイライト表示
                this.highlightLinkHistory();
            } else {
                alert('アップロードに失敗しました: ' + result.error);
            }
        } catch (error) {
            console.error('アップロードエラー:', error);
            alert('アップロードに失敗しました');
        } finally {
            this.uploadBtn.disabled = false;
            this.uploadBtn.textContent = 'アップロード';
        }
    }

    /**
     * アップロードキャンセル
     */
    cancelUpload() {
        this.selectedFiles = [];
        this.previewArea.style.display = 'none';
        this.fileInput.value = '';
    }

    /**
     * リンク履歴に追加
     */
    addToLinkHistory(url) {
        const history = this.loadLinkHistory();
        history.unshift({
            url: url,
            timestamp: new Date().toISOString()
        });
        this.saveLinkHistory(history);
        this.renderLinkHistory();
    }

    /**
     * 最新のリンク行をハイライト表示
     */
    highlightLinkHistory() {
        // 最新のリンク行（最初の行）をハイライト
        const firstLinkItem = document.querySelector('.link-item');
        if (firstLinkItem) {
            firstLinkItem.classList.add('new-link-highlight');
            
            // リンク履歴エリアを自動でスクロール
            const historySection = document.querySelector('.history-section');
            historySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // 3秒後にハイライトを解除
            setTimeout(() => {
                firstLinkItem.classList.remove('new-link-highlight');
            }, 3000);
        }
    }

    /**
     * リンク履歴の読み込み
     */
    loadLinkHistory() {
        const stored = localStorage.getItem('linkHistory');
        return stored ? JSON.parse(stored) : [];
    }

    /**
     * リンク履歴の保存
     */
    saveLinkHistory(history) {
        localStorage.setItem('linkHistory', JSON.stringify(history));
    }

    /**
     * リンク履歴の表示
     */
    renderLinkHistory() {
        const history = this.loadLinkHistory();
        const historyElement = document.getElementById('linkHistory');
        
        if (history.length === 0) {
            historyElement.innerHTML = '<p class="no-links">まだリンクが生成されていません</p>';
            return;
        }

        historyElement.innerHTML = history.map((item, index) => `
            <div class="link-item" data-index="${index}">
                <div class="link-url">${item.url}</div>
                <button class="copy-btn" data-url="${item.url}">コピー</button>
            </div>
        `).join('');

        // コピーボタンのイベント設定
        historyElement.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.copyToClipboard(btn.dataset.url, btn);
            });
        });

        // 行クリックのイベント設定
        historyElement.querySelectorAll('.link-item').forEach(item => {
            item.addEventListener('click', () => {
                const url = item.querySelector('.link-url').textContent;
                this.copyToClipboard(url, item.querySelector('.copy-btn'));
            });
        });
    }

    /**
     * クリップボードにコピー
     */
    async copyToClipboard(url, button) {
        try {
            await navigator.clipboard.writeText(url);
            button.innerHTML = '✓';
            button.classList.add('copied');
            
            setTimeout(() => {
                button.textContent = 'コピー';
                button.classList.remove('copied');
            }, 2000);
        } catch (error) {
            console.error('コピーに失敗しました:', error);
            alert('コピーに失敗しました');
        }
    }

    /**
     * GCファイル選択処理
     */
    handleGcFileSelect(files) {
        if (files.length > 0) {
            this.gcExecuteBtn.style.display = 'inline-block';
            this.gcResult.style.display = 'none';
        }
    }

    /**
     * GC実行
     */
    async executeGC() {
        const file = this.gcFileInput.files[0];
        if (!file) return;

        this.gcExecuteBtn.disabled = true;
        this.gcExecuteBtn.textContent = '実行中...';

        try {
            const formData = new FormData();
            formData.append('backup', file);

            const response = await fetch('/api/gc', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.gcResult.className = 'gc-result success';
                this.gcResult.innerHTML = `
                    <strong>GC処理が完了しました</strong><br>
                    削除されたファイル数: ${result.deletedCount}<br>
                    削除されたファイル: ${result.deletedFiles.join(', ') || 'なし'}
                `;
            } else {
                this.gcResult.className = 'gc-result error';
                this.gcResult.innerHTML = `<strong>GC処理に失敗しました:</strong> ${result.error}`;
            }
        } catch (error) {
            console.error('GC処理エラー:', error);
            this.gcResult.className = 'gc-result error';
            this.gcResult.innerHTML = '<strong>GC処理に失敗しました</strong>';
        } finally {
            this.gcResult.style.display = 'block';
            this.gcExecuteBtn.disabled = false;
            this.gcExecuteBtn.textContent = 'GC実行';
            this.gcFileInput.value = '';
            this.gcExecuteBtn.style.display = 'none';
        }
    }
}

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
    new FileUploader();
});


