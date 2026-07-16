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

---

## 将来のクローラー設計メモ

### 予約SaaSアダプタ（3本に整理）

| アダプタ | 対象 | 備考 |
|---|---|---|
| `tennisbear` | reserve.tennisbear.net / www.tennisbear.net | SENKO潮見、MEIJI PARK など |
| `reserva` | reserva.be | ピックルボールワン銀座新橋など |
| `shibuya-rental` | shibuya-rental.space | shibuya pickleball club |

### RESERVA の特性
「空き状況」ページが**プラン単位**で構成されているため、**1施設のクロールで全プランを一括取得できる**。
コート貸切と体験会/レッスンが同一ページに並ぶので、取得後に種別判定を行う。

### プラン種別の判定
プラン名の辞書マッチで `kind` を決定する:

```
event 系  : 体験会 / 初心者 / オープンプレイ / ドロップイン / 交流会
lesson 系 : レッスン / スクール / クラス / 講習
court 系  : レンタル / コート / 貸切 / ONE / FUN
```

判定できない、または辞書が誤判定する場合に備え、施設データに手動オーバーライド用の
`kind_override` フィールドを持たせる（`{ planId: "one-taiken", kind: "event" }` の形）。

### 鉄則
空き枠グリッドの「N件 空きあり」は **`kind === "court"` のプランのみ**を集計すること。
体験会・レッスンを混ぜるとコートを探すユーザーへの誤情報になる。
