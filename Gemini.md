# Gemini UI/UX依頼書（Depictionator）

目的: UI/UXを完成度の高い状態に引き上げる。バックエンドは実装済みのため、UIは「使える」より「迷わず・速く・安全に」操作できることを重視。

## 現状の課題（UI観点）
- いまのUIはフォームの寄せ集めで、操作が分断されている。
- マップ編集が「画像上への直接プロット/直感操作」になっていない。
- Wikipedia等からのインポートUIがない。
- 編集体験がMediaWiki的に「軽快・構造化・簡単」になっていない。
- UI言語切替がない（日本語/英語など）。

## 直近の追加（最低限のUI足場）
- MapEditorに「ピン追加(クリック) + 編集トグル(ドラッグ/更新) + 凡例(イベント/地点/動線)」を追加済み。
- Articleに見出しToC、Markdownエディタの分割プレビューを追加済み。
- 記事/地図向けにWikipedia検索・プレビュー・取り込みの簡易パネルを追加済み。

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
- **多言語統合インポート**:
  - 日本語記事が無い場合は他言語から取り込み可能（UIで言語を複数選択）。
  - 可能なら「複数言語記事をLLMで統合 → 出典一覧を維持」のワークフローを用意。
  - 取り込み結果には言語別の出典を明記できるUIを用意。

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
- Wiki統合インポート時はLLM利用可否のトグルが必要（利用不可なら通常インポートのみ）。

## 作業範囲（Gemini担当）
- UI全般のUX設計と実装（Map/Article/Timeline/Review/LLMパネル）。
- 画面遷移の設計と速度/わかりやすさの最適化。
- エディタと地図の「操作性」強化。

## 参考
- Wikipedia/MediaWiki のUI感（検索→プレビュー→編集）に寄せると良い。
- Mapは「Figmaのキャンバス操作」感を目指す。

## Gemini CLI所見（2026-01-15）
- 現状UIはフォーム過多で作業が分断され、直接操作（クリック配置・ドラッグ編集）が不足。
- Mapsは「キャンバス上操作＋レイヤー切替＋凡例」を中核に再設計する必要あり。
- Articlesは「見出しナビ＋即時プレビュー＋差分/履歴導線」を中心にMediaWiki風へ。
- Timelineも長大フォームを分割し、編集対象の絞り込み・見通し改善が必要。

## Gemini CLI所見（gemini-3-pro-preview, 2026-01-15）
- クリック配置で即時ピン作成＋フローティング編集メニュー。
- ピン/動線のドラッグ編集とリアルタイムMarkerStyle反映。
- 記事はMarkdown/プレビューの分割ビューを常設。
- 記事に見出しToCを固定表示して長文編集を安定化。
- Wikiインポートを統合モーダル（検索→プレビュー→取り込み）に集約。
- Era/Chapter/Viewpointのコンテキストバーを固定して全画面に反映。

## 実UI確認（agent-browser, 2026-01-15）
- ダッシュボード/Maps画面は表示確認済み（internal.copiqta.com）。
- Maps画面は「Map未選択だと編集UIが出ない」ため、初期選択 or 空状態の導線改善が必要。
- 依然としてフォーム群が主で、Gemini側のUI再設計が前提。

## 実UI確認（agent-browser, 2026-01-15 追記）
- Articles: 作成/インポート/一覧が縦に長いフォームで分断。左カラム一覧・右カラム本文のようなMediaWiki的閲覧/編集導線が不足。
- Timeline: ほぼ全てが巨大フォーム。年表の一覧表示や時間軸ビューが無い。作成/更新/閲覧の分離が必要。
- Reviews: 依頼一覧と監査ログの一覧だけ。レビュー差分/承認/差戻しの主導線が弱い。
- Settings: 機能は揃っているが、ワークスペース設定/アセット/LLM設定が長大なフォームで視認性が低い。
- Maps: 画面表示は復旧。未作成時は「Select a map to edit」表示のみで、初期作成/インポート誘導を強化したい。

## Gemini CLI attempt (2026-01-15)
- Gemini CLI timed out repeatedly; manual UI/UX directives appended below.

## UI/UX directives (manual, for Gemini)
- IA: Fixed global filter bar (Era/Chapter/Viewpoint/Mode) + workspace switcher + main nav (Articles/Maps/Timeline/Reviews/Settings). Use left sidebar for nav, right inspector/drawer for details.
- Articles (read): 3-pane layout: left entity list with search/type/status/tags/unread; center article with sticky TOC; right metadata (era/story/viewpoint, sources, revision status, watch/read).
- Articles (edit): inline section edit with split preview; toolbar for headings/links/quotes; image drag/drop with asset picker; references panel.
- Maps: full-canvas editor with top toolbar (Select/Pin/Path/Area/Measure). Click to place pins, drag to move, shift-click to add path points, snap/undo, right-panel inspector for selected item.
- Map layers: toggles for pins/paths/events/canon/viewpoint/story/world; legend showing marker style by event/location type; quick filter chips.
- Timeline: toggle World/Story tabs + visual timeline view (card lanes) + list fallback; per-event chips (type, chapter, map link); quick create and batch edit.
- Reviews: queue by status tabs, inline diff viewer, approve/reject with required comment; assignment UI.
- Settings: tabs (Workspace, Members/Roles, LLM, Integrations, Locale), each with short forms + descriptions.
- LLM panel: right drawer with context summary, prompt templates, “insert as draft” button, execution log.
- i18n: language switcher in header (ja/en), persists in user settings + cookie; show translation completeness badge.
- Empty states: show “Create / Import / Sample data” CTAs per page.
- Accessibility: keyboard focus styles, ARIA labels, color contrast, non-color legend cues, shortcuts cheat sheet.
- Quick wins: auto-select first map; sticky global filter; reduce form length with collapsible sections.

## Gemini CLI directives (direct, 2026-01-15)
- Source: gemini-3-pro-preview via direct gemini CLI (no MCP). Output summarized below.

### Information architecture & navigation
- Left sidebar: Dashboard, Articles, Maps, Timeline, Reviews, Settings; bottom user/profile.
- Top bar: fixed global filters (Era/Chapter/Viewpoint/Mode), global search, create (+), notifications, locale toggle (JA/EN).
- Right drawer: contextual tools (LLM, ToC, inspector) depending on page/selection.

### Articles (MediaWiki-like)
- List: faceted search (type/status/tags), status badges, create modal.
- Read view: 3-column (nav tree / content / metadata), sticky TOC, header with Edit/History/Comments.
- Edit view: split editor/preview or tabs, toolbar for headings/links/quotes, drag/drop images, section-level editing.

### Maps (Figma-like canvas)
- Full-screen canvas; floating toolbar (select/pin/path/area/measure).
- Floating layers/legend panel; inspector panel on right for selected item fields.
- Interactions: click-to-add pin, drag-to-move, ctrl-snap paths to pins, hover tooltip.

### Timeline
- Visual swimlane view with world/story/character lanes; event cards open inspector.
- List fallback for bulk edits.

### Reviews
- PR-like dashboard: tabs (needs review/approved/rejected/my requests), split diff viewer, approve/reject with mandatory comment.

### Settings
- Vertical tabs: General, Members, LLM, Integrations; model selection, API keys, prompt system settings.

### Accessibility
- Keyboard focus styles, ARIA labels, contrast, non-color legend cues.

### Quick wins vs larger redesign
- Quick wins: locale toggle, active sidebar state, sticky filters, empty-state CTAs.
- Larger redesign: replace MapEditor with CanvasMapEditor + inspector/drawer; SplitPaneEditor; DiffViewer.

### Implementation phases (suggested)
- Phase 1: shell layout + global filters + locale switcher.
- Phase 2: map canvas + inspector + click/drag tools.
- Phase 3: article split editor + drag/drop assets + TOC.
- Phase 4: reviews UI + empty states.
