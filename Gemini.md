# Gemini UI/UX依頼書（Depictionator）

目的: UI/UXを完成度の高い状態に引き上げる。バックエンドは実装済みのため、UIは「使える」より「迷わず・速く・安全に」操作できることを重視。

## 現状の課題（UI観点）
- いまのUIはフォームの寄せ集めで、操作が分断されている。
- マップ編集が「画像上への直接プロット/直感操作」になっていない。
- Wikipedia等からのインポートUIがない。
- 編集体験がMediaWiki的に「軽快・構造化・簡単」になっていない。
- UI言語切替がない（日本語/英語など）。

## 目標UX
1) **MediaWiki級の編集体験**
- WYSIWYGとMarkdownのハイブリッド（即時プレビュー/セクション編集/見出しナビ）。
- 画像ドラッグ&ドロップ、出典情報入力を編集画面内で完結。
- 章・時代・視点（Canon/Belief）を上部で常時切替。
- 差分/履歴/レビューの導線が明快。

2) **マップ編集の直感操作**
- 画像上クリックでピン設置。
- ピン/動線のドラッグ移動、スナップ、削除、複数選択。
- イベント種別/地点種別/視点/真偽フラグに応じた**形状・色分け**を即時反映。
- レイヤーON/OFF（Canon/Belief/World/Story/Entity種別）。

3) **Wikipedia/MediaWiki連携UI**
- 検索 → プレビュー（本文/画像/ライセンス） → 取り込み先（記事/地図/アセット）選択。
- 取り込み時にTASL（Title/Author/Source/License）を表示・保存。
- 画像はWikimedia Commons対応。

4) **多言語UI**
- 画面右上に言語切替（日本語/英語）。
- 切替は即時反映、ユーザー設定として保存。

## 使えるバックエンドAPI（新規追加含む）
### Wikipedia/MediaWiki
- POST `/api/wiki/search`
  - form: `query`, `lang` (例: `en`, `ja`, `commons`)
- POST `/api/wiki/page`
  - form: `pageId` or `title`, `lang`
- POST `/api/wiki/import/article`
  - form: `workspaceId`, `pageId` or `title`, `lang`, `entityType`, `publish`
  - `publish=true`で即時公開リビジョン化
- POST `/api/wiki/import/asset`
  - form: `workspaceId`, `imageTitle`, `lang`
- POST `/api/wiki/import/map`
  - form: `workspaceId`, `mapTitle`, `imageTitle`, `bounds`, `parentMapId`, `lang`

### Locale
- POST `/api/i18n/set`
  - form: `locale` (`ja`/`en`)
  - ユーザー設定 + `ui_locale` cookie を更新

### 既存主要機能
- 記事/リビジョン/レビュー/タイムライン/地図/ピン/動線/通知 などのCRUDは既存APIで実装済み。

## UIで必須の導線
- **グローバルフィルタ**: World Era + Story Chapter + Viewpoint
- **Map Editor**: 上記フィルタ連動でレイヤー可視化
- **Review**: 下書き→レビュー依頼→承認/差戻し
- **PDF出力**: 記事/地図/年表の選択 → 出力

## 視覚表現の必須ルール
- ピン/動線の **形状・色** は MarkerStyle を視覚化。
- できれば「Legend（凡例）」を自動表示。
- Canon/Beliefの差は視覚的に一目で分かる表現に。

## 注意点
- 既存APIはCookie認証（Secure）なので **HTTPS前提**。
- フォーム投稿は `multipart/form-data` ベース。

## 作業範囲（Gemini担当）
- UI全般のUX設計と実装（Map/Article/Timeline/Review/LLMパネル）。
- 画面遷移の設計と速度/わかりやすさの最適化。
- エディタと地図の「操作性」強化。

## 参考
- Wikipedia/MediaWiki のUI感（検索→プレビュー→編集）に寄せると良い。
- Mapは「Figmaのキャンバス操作」感を目指す。
