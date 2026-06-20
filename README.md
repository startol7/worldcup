# Insolvency Map — NZ Company Liquidation Tracker

清算・倒産企業を地図上にピンで可視化するサイト。
データは `data.json` から読み込むので、**そのファイルを差し替えるだけで地図が更新されます。**

## ファイル構成
```
index.html   ← サイト本体（CSS/JS込み・編集不要）
data.json    ← データ。ここを実データに差し替える
README.md
```

## data.json の形式
レコードの配列。`lat` と `lng`（数値）が必須。他は任意。
```json
[
  {
    "company": "SHAPE ENERGY LIMITED",
    "nzbn": "9429051699222",
    "address": "16 Gilmour St, New Plymouth",
    "lat": -39.0625,
    "lng": 174.0608,
    "type": "Winding up Application",
    "date": "2026-01-28",
    "directors": ["Stephen Wilmshurst"],
    "pdf": "https://example.com/notice.pdf"
  }
]
```
- `type` に使える値（凡例・色付きのもの）:
  `Liquidation` / `Receivership` / `Winding up Application` /
  `Liquidator Appointed` / `Receiver Appointed` / `Removed`
  （これ以外の値はグレーのピンで表示）
- `date` は `YYYY-MM-DD` 文字列。日付レンジ絞り込みに使用。
- `lat`/`lng` の無いレコードは自動で除外。

## 公開（GitHub Pages）
1. `index.html` と `data.json` をリポジトリ直下に置く
2. Settings → Pages → Source: Deploy from a branch → main / (root) → Save
3. `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開

## 注意
- `data.json` は `fetch` で読むため、**http(s) 配信が必要**です。
  `index.html` をダブルクリックして `file://` で開くとブラウザがJSON読込をブロックし、
  「Could not load data.json」と表示されます（GitHub Pages なら問題なし）。
- ローカル確認したい場合: フォルダ内で `python -m http.server` を実行し
  `http://localhost:8000` を開く。

## 実データ化のパイプライン（参考）
gazette クロール → ジオコーディング(住所→緯度経度) → data.json 生成 → 週次バッチ更新
