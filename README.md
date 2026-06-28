# WORLD CUP KNOCKOUT ⚽🏆

サッカー・ワールドカップの決勝トーナメントを PK 対決で勝ち上がるブラウザゲーム。
HTML 1枚で動く完全クライアントサイド製（サーバー・ビルド不要）。

## 遊び方
- 出場国（実在16カ国）と選手タイプ（⚡ストライカー / 🎯テクニシャン / 🧤守護神 / ⭐キャプテン）を選ぶ
- 攻撃: ゴールを狙う → 押して溜める → 緑のスイートゾーンで離すと正確＆強いシュート
- 守備: キーパーを左右に動かしてセーブ
- ベスト16 → 準々決勝 → 準決勝 → 決勝（決勝に近づくほど難化）
- 実際の組み合わせ。例: 日本の初戦は 🇧🇷 ブラジル

## ローカルで動かす
`index.html` をブラウザで開くだけ。（three.js を CDN から読むのでネット接続が必要）

## GitHub で公開（GitHub Pages）
1. このフォルダを GitHub リポジトリにプッシュ
2. リポジトリの Settings → Pages → Branch を `main` / `/ (root)` に設定して Save
3. 数分後 `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開（`index.html` が自動表示）

## Render で公開（Static Site）
方法A: 同梱の `render.yaml` を使う
1. GitHub にプッシュ
2. Render で New + → Blueprint → このリポジトリを選択 → Apply

方法B: 手動
1. Render で New + → Static Site → リポジトリを選択
2. Build Command: 空欄 / Publish Directory: `.`
3. Create Static Site

## ファイル
- `index.html` … ゲーム本体（これだけで動く）
- `render.yaml` … Render 用の公開設定

## 注意
- 画面内の「広告スペース（AdSense）」はデモ用のダミー枠です。実際に広告を出す場合は AdSense 等の審査・タグ設置が別途必要です。
