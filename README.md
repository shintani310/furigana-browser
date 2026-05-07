# ふりがなブラウザ PWA

子供（小学生）が**自力でインターネットを検索して読める**ことを目的とした、ふりがな付きブラウザPWA。家族用・非公開。

## 何ができるか（実装後）

- 検索バーから DuckDuckGo 検索（Googleはbot検知不可）
- 検索結果のリンクをタップすると次のページもふりがな付きで開く
- 戻る・進む ボタンで普通のブラウザ感覚で操作
- 学年（1〜6年）に応じてふりがなの量を調整
- 「📖 本文だけ」と「🖼 そのまま」の表示モード切替
- 履歴・お気に入り（ローカル保存）
- ホーム画面にPWAインストール可能

## 状態（2026-05-06）

✅ **層1: 技術移植完了**
- `js/furigana.js`, `js/extractor.js`, `js/fullcopy.js`, `js/storage.js` 既存リーダーから移植
- `data/kanji-grades.json`（教育漢字1006字）
- `dict/`（kuromoji辞書 12ファイル / 約17MB）
- `icons/`（PWAアイコン3種）

⏳ **層2: 新機能実装（次の新チャットで）**
- `index.html` SPA本体
- `js/app.js` SPAルーター（history.pushState）
- `js/home.js` ホーム画面（検索バー）
- `js/search.js` DuckDuckGo検索発行 + URLアンラップ
- `js/browse.js` BROWSE state
- `js/linkrouter.js` リンク乗っ取り
- `js/browserchrome.js` 上部バー（戻る/進む/学年/モード/再読込）
- `manifest.webmanifest`, `sw.js`, `css/style.css`

## 関連プロジェクト（依存）

- **既存PWA「ふりがなリーダー」**: 別フォルダ `~/Desktop/ふりがなPWA_AIワークスペース/` で家族稼働中。**触らない**こと。
- **Cloudflare Worker**: `furigana-proxy.furigana-reader.workers.dev` を共有利用。`ALLOWED_ORIGINS` の `https://shintani310.github.io`（host単位）で既に新プロジェクトもカバー済み、追加設定不要。

## 計画ファイル

詳細は `~/.claude/plans/pwa-web-url-fluffy-biscuit.md` を参照。

## ライセンス

家族内利用のため License 未設定。kuromoji 辞書（Apache 2.0、`dict/`）は同梱しているが、再配布しない範囲で使用。
