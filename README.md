# ピックルイキタイ 🎾

東京+関東のピックルボールコート横断検索ポータル（β / MVP）

## ローカル起動
```bash
npm install
npm run dev
```

## 公開手順

### 1. GitHubに上げる（このフォルダで）
```bash
git init && git add -A && git commit -m "pickle-ikitai MVP v7"
gh repo create pickle-ikitai --public --source=. --push
# gh未導入なら: GitHubでリポジトリ作成後
# git remote add origin https://github.com/<user>/pickle-ikitai.git && git push -u origin main
```

### 2. Netlifyで公開（どちらか）
- **最速(1分)**: https://app.netlify.com/drop に `dist` フォルダをドラッグ&ドロップ
- **推奨(自動デプロイ)**: Netlify → Add new site → Import from GitHub → pickle-ikitai を選択
  （netlify.toml があるのでビルド設定は自動: `npm run build` / publish `dist`）

## 構成
- Vite + React 18(単一コンポーネント: src/App.jsx)
- データは App.jsx 内のシード(SEED_FACILITIES)。空き枠はモック
- ユーザー投稿はメモリ内のみ(リロードで消える) → 本実装は Cloudflare D1 予定
