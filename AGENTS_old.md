# WorldLore Atlas - AGENTS.md (for Codex)

このリポジトリは、ゲーム開発チーム向けの「世界観設定・資料集約Webアプリ」です。
記事ビュー（Markdown中心）と地図ビュー（世界地図〜都市地図の階層、ピン＆動線）を核に、
タイムライン整理（世界史ライン / ゲームストーリーラインを分離）、関係図、PDF出力、
LLM（Gemini API / Codex CLI exec）統合を提供します。

本プロダクトは **小規模チームが共有利用するため、何らかのサービス（PaaS）またはVPSにデプロイ**して運用します。

---

## 0. 重要原則（MUST）

### 0.1 データ保全
- MUST: 破壊的操作（ハード削除、強制上書き、rm -rf 等）をしない。
- MUST: 削除はソフトデリート＋復元。
- MUST: 変更履歴（リビジョン）と監査ログ（audit）を全主要オブジェクトに残す。

### 0.2 “正史” と “視点情報” を混同しない
- MUST: 世界の「正史（Canon）」と、キャラクター/陣営が「そう信じている情報（Belief）」を分離して保存できること。
- MUST: Beliefには「誤認／虚偽／プロパガンダ」を明示できること（信頼できない語り手の表現）。

### 0.3 “時代” と “ストーリー進行” を混同しない
- MUST: 世界史（ワールド時間）と、ゲーム内のストーリー進行（章/シーン順）を別軸として扱う。
  - 例: フラッシュバックは「ワールド時間は過去」だが「ストーリー進行は後」になり得る。

### 0.4 外部引用の扱い
- MUST: Wikipedia/Wikimedia等から引用・画像取り込みをする場合、出典URL・取得日時・作者・ライセンス・クレジット文（TASL等）を保存し、PDFにも出力する。

### 0.5 デプロイ運用
- MUST: Dockerで再現可能（Dockerfile + docker-compose.yml）。
- MUST: DB/Assetsは永続ボリューム。バックアップ手順をREADMEに記載。
- MUST: APIキー（Gemini等）はサーバ側で管理し、クライアントへ配布しない。

---

## 1. 成果物（ゴール）

### 1.1 MVP（到達状態）
- サービス or VPS にデプロイできるWebアプリ
- ワークスペース（プロジェクト）単位でデータ分離
- 認証（ログイン）と権限（RBAC）
- 記事（MD）CRUD、テンプレ作成、画像D&D添付
- 地図CRUD（世界→地域→都市）、ピン、動線（矢印）編集
- タイムライン
  - 世界史ライン（World History）
  - ゲームストーリーライン（Game Storyline / Chapters）
  - それぞれを区別し、相互リンク可能
- **グローバルフィルタ**
  - (A) ワールド時代/日付
  - (B) ストーリー章/シーン
  - (C) 視点（キャラ/陣営/プレイヤー/全知=正史）
  - で、記事・地図・タイムラインの表示が一貫して切り替わる
- 監査（作成者/編集者/レビュー履歴）、コメント、レビュー（承認/差し戻し）
- ウォッチ（更新通知）と既読/未読
- PDF出力（記事＋地図＋年表＋図を任意組み合わせ、目次・クレジット付き）
- どの画面でもLLMパネルでGemini API / Codex CLI exec を呼べる

### 1.2 非ゴール（MVPではしない）
- 完全リアルタイム共同編集（Phase2）
- 複雑な承認ワークフロー（MVPは「レビュー依頼→承認/差し戻し」まで）
- 公開配布向け（社内運用前提）

---

## 2. 技術スタック（提案）
- TypeScript
- Web: Next.js（App RouterでもPagesでも可） or React + Node API
- DB: Postgres（デプロイ前提のためMVPからPostgres推奨）
- ORM: Prisma 等
- Assets: S3互換（VPSならMinIO） or ローカル永続ボリューム
- 地図: Leaflet
  - 架空地図は画像オーバーレイ（CRS.Simple相当の非地理座標）
  - 矢印付き動線は PolylineDecorator 相当で実装
- Markdown:
  - 編集: MD + 画像D&D
  - 表示: MDレンダラ（拡張ブロック対応）
- 図: Mermaid（相関図/組織図）
- PDF: Puppeteer（HTML/CSS→PDF）
- 通知: In-app通知（必須） + Email（任意、SMTP設定がある場合）
- Job実行: 単純には同一プロセスでも可。ただしPDF生成・外部取得・通知送信は将来worker化しやすく設計。

---

## 3. コア概念（“情報の区別” を実現する設計）

### 3.1 3つの軸
本ツールは情報を次の3軸でフィルタリングできる必要がある：

1) **World Time（世界史時間）**
- Era（時代）で区切る
- Entityの存在期間、Eventの発生期間、Map要素（ピン/動線）の有効期間を持つ

2) **Story Progress（ストーリー進行）**
- Chapter/Scene（章/シーン順）で区切る
- 「プレイヤーがその時点で知ってよい情報」を制御する（ネタバレ防止・演出）

3) **Viewpoint（視点/認識主体）**
- Player、特定Faction、特定Characterなど
- 同じ対象でも視点によって “見えている情報” を変える
- 誤認/虚偽情報（unreliable narrator）も視点ごとに持てる

### 3.2 Canon と Belief
- Canon: 正史（制作側が採用している正しい設定）
- Belief: ある視点が信じている情報（正誤を問わない）
  - truthFlag: canonical / rumor / mistaken / propaganda / unknown
  - optional: canonicalRef（対応する正史情報への参照）

---

## 4. データモデル（MVP必須）

### 4.1 ワークスペース & ユーザー
- Workspace
  - id, name, slug, createdAt
- User
  - id, email, name, avatarUrl, createdAt
- WorkspaceMember
  - workspaceId, userId, role
  - role: admin / editor / reviewer / viewer

### 4.2 エンティティ（世界観の対象）
- EntityType（最低限）
  - Nation, Faction, Character, Location, Building, Item, Event, Map, Concept(世界観設定:魔法体系/技術/用語)
- Entity（共通）
  - id, workspaceId, type, title, aliases[], tags[]
  - status: draft / in_review / approved / deprecated
  - worldExistFrom (nullable), worldExistTo (nullable)   # 世界史上の存在期間
  - storyIntroChapterId (nullable)                      # ストーリー上の初登場（“知られてよい”開始）
  - createdAt, updatedAt, createdBy, updatedBy
  - softDeletedAt (nullable)

### 4.3 記事（Markdown）
記事は「正史ベース」と「視点/時代/章で切り替わるオーバーレイ」に分ける。

- Article
  - entityId (PK), workspaceId
  - baseRevisionId（現在の公開/採用リビジョン）
- ArticleOverlay
  - overlayId, entityId, workspaceId
  - viewpointId (nullable: null=Canon overlay)
  - worldFrom/worldTo (nullable)
  - storyFromChapterId/storyToChapterId (nullable)
  - truthFlag（canonical/rumor/mistaken/propaganda/unknown）
  - title（例: "帝国軍が信じる史実"）
  - activeRevisionId（現在の採用リビジョン）
- ArticleRevision
  - revisionId, targetType: base|overlay, targetId (entityId or overlayId)
  - bodyMd
  - changeSummary
  - createdAt, createdBy
  - status: draft / submitted / approved / rejected
  - approvedAt, approvedBy（nullable）
  - parentRevisionId（差分追跡用）

### 4.4 視点（Viewpoint）
- Viewpoint
  - id, workspaceId
  - type: player / faction / character / omniscient
  - entityId（faction/characterの場合）
  - name
  - description

### 4.5 タイムライン（世界史ライン / ストーリーライン分離）
- Timeline
  - id, workspaceId
  - type: world_history / game_storyline / dev_meta(optional)
  - name
- Event（EntityType=Event としても扱えるが、タイムライン機能のため別表でも可）
  - id, workspaceId, timelineId
  - title
  - worldStart/worldEnd（世界史上の日時/時代。MVPはISO文字列+Eraでも可）
  - storyOrder（ストーリー表示順の数値 or chapterId参照）
  - summaryMd
  - involvedEntityIds[]
  - locationRef: { mapId, pinId?, x?, y? } (nullable)
  - createdAt, updatedAt, createdBy, updatedBy
  - softDeletedAt

- Era（世界史の区切り）
  - id, workspaceId
  - name
  - worldStart/worldEnd（MVPは文字列でも可）
  - sortKey（表示順）

- Chapter（ストーリー進行）
  - id, workspaceId
  - name
  - orderIndex（必須）
  - description

### 4.6 地図（階層地図 / フィルタ連動）
- Map
  - id, workspaceId
  - title
  - parentMapId（世界→地域→都市）
  - imageAssetId
  - crs: "simple"
  - bounds: [[y0,x0],[y1,x1]]
  - createdAt, updatedAt, createdBy, updatedBy
  - softDeletedAt
- Pin
  - id, mapId, workspaceId
  - x,y
  - entityId（人物/施設/都市等）
  - worldFrom/worldTo（nullable）
  - storyFromChapterId/storyToChapterId（nullable）
  - viewpointId（nullable: null=正史表示）
  - truthFlag（canonical/rumor/mistaken/propaganda/unknown）
  - label, iconKey
- Path（動線）
  - id, mapId, workspaceId
  - polyline: [{x,y}...]
  - worldFrom/worldTo（nullable）
  - storyFromChapterId/storyToChapterId（nullable）
  - viewpointId（nullable）
  - truthFlag
  - arrowStyle（矢印/点線等）
  - relatedEntityIds[]
  - relatedEventId（nullable）

### 4.7 Assets & クレジット
- Asset
  - id, workspaceId
  - kind: image / file
  - storageKey, mimeType, size
  - width,height（画像のみ）
  - createdAt, createdBy
  - source:
    - sourceUrl (nullable)
    - author (nullable)
    - licenseId (nullable)
    - licenseUrl (nullable)
    - attributionText (nullable)
    - retrievedAt (nullable)

---

## 5. 監査（Audit）・権限（Authority）・レビュー（Review）

### 5.1 監査ログ（必須）
- AuditLog
  - id, workspaceId
  - actorUserId
  - action: create/update/delete/restore/submit_review/approve/reject/login/etc
  - targetType, targetId
  - meta（差分サマリ、IP等は必要なら）
  - createdAt

MUST:
- 記事編集は「誰が」「いつ」「どのリビジョンを」「何として（要約）」を追えること。

### 5.2 RBAC（必須）
- viewer: 閲覧のみ
- editor: 下書き作成/編集、レビュー依頼
- reviewer: 承認/差し戻し
- admin: メンバー管理、設定、削除復元

MUST:
- “視点情報（Belief）” は誤認を含むため、編集権限を厳しめにできる設計（例: reviewer以上のみ作成可）も可能に。

### 5.3 レビュー（必須）
- ReviewRequest
  - id, workspaceId
  - revisionId
  - requestedBy, requestedAt
  - assignedReviewerIds[]
  - status: open/approved/rejected
- ReviewComment（スレッド式でも可）
  - id, reviewRequestId, userId, bodyMd, createdAt

仕様:
- editorがrevisionを `submitted` にし、reviewerが `approved` にすると、そのrevisionが `activeRevisionId/baseRevisionId` に昇格する。
- 差し戻しの場合は `rejected`。理由コメント必須。

---

## 6. ウォッチ（更新通知）・既読/未読

### 6.1 Watch（必須）
- Watch
  - userId, workspaceId
  - targetType: entity/map/timeline/event/review
  - targetId
  - notify: in_app (必須) / email（任意）
  - createdAt

通知トリガ:
- 対象が更新（新リビジョン採用/承認）
- コメントが付いた
- レビュー依頼が来た / 承認された / 差し戻しされた
- 自分がメンションされた

### 6.2 Notification（必須）
- Notification
  - id, userId, workspaceId
  - type
  - payload（target, message, url等）
  - createdAt
  - readAt (nullable)

### 6.3 既読（必須）
- ReadState
  - userId, workspaceId
  - targetType, targetId
  - lastReadAt
  - lastReadRevisionId（記事の場合）

UI要件:
- 記事一覧/地図一覧で「未読更新バッジ」を表示（最新採用revision > lastReadRevision）。
- 記事を開いたら既読にする（設定でOFFも可）。

---

## 7. UI/UX要件（MVP）

### 7.1 グローバルフィルタ（最重要）
全画面の上部（固定バー）に以下を置く：
- World: Era（必須） + 日付/範囲（任意）
- Story: Chapter（任意。指定時はネタバレ制御が効く）
- Viewpoint: Omni(Canon) / Player / Faction / Character
- 表示モード:
  - Canon（正史のみ）
  - As Viewpoint（視点情報のみ）
  - Compare（正史 vs 視点 を左右分割で比較）

### 7.2 記事ビュー
- 左: エンティティ一覧（type/tags/status、全文検索、未読フィルタ）
- 右: 記事
  - 上部に “このページをウォッチ” “既読/未読” “レビュー依頼” “変更履歴”
  - 表示はグローバルフィルタに従う（base + overlays のうち該当するものだけ）
- 編集:
  - base編集（正史ベース）
  - overlay編集（視点/時代/章/真偽フラグを付けて作成）
  - 画像D&D→Asset化→MDに自動挿入
- 履歴:
  - revision一覧、diff表示、復元（新revisionとして）

### 7.3 地図ビュー
- 地図階層（世界→地域→都市）
- ピン/動線のCRUD
- ピン/動線にも overlay 相当のメタ（world/story/viewpoint/truthFlag）があり、グローバルフィルタで出し分ける
- クリックで関連記事へ、記事側からピンへジャンプ
- “シーンスナップショット”（表示レイヤー状態保存）はPhase2でも良いが、設計は入れておく

### 7.4 タイムライン
- タブで timeline type を切替:
  - World History（世界史）
  - Game Storyline（ストーリーライン）
- Event一覧はグローバルフィルタで絞り込み
- Event→地図位置へジャンプ、関与エンティティへジャンプ
- 1つのEventに worldStart/worldEnd と storyOrder の両方を持たせられる（回想表現のため）

### 7.5 相関図/組織図
- Mermaidソースを記事に埋め込み or 専用エンティティで管理
- フィルタ（時代/視点）により、表示対象エンティティが変わっても破綻しないように “存在しないノードは灰色/非表示” 等のルールを定める（実装簡略化のためMVPは非表示推奨）

### 7.6 LLMパネル（全画面）
- 右ドロワーで開く
- プロバイダ切替:
  - Gemini API
  - Codex CLI exec（サーバ側）
- 入力に自動で現在コンテキストを添付:
  - 開いている記事（base/overlay、フィルタ状態も）
  - 選択中のピン/動線/イベント
- 出力は “提案（下書き）” として扱い、勝手に本番反映しない
- 実行ログを保存（監査対象）

---

## 8. PDF出力（印刷セット）
- “印刷セットビルダー”
  - 記事、地図（現在フィルタ状態のレンダリング結果）、タイムライン、図を任意に追加
  - ドラッグで並び替え
  - 表紙/目次/ページ番号
  - 外部引用/画像のクレジット一覧（必須）
- PDFはPuppeteerで生成（サーバ側）

---

## 9. デプロイ要件（サービス/VPS）
MUST:
- Dockerfile / docker-compose.yml を提供
- .env.example を用意
- DBマイグレーション手順
- 永続化:
  - Postgres volume
  - Assets volume（またはS3/MinIO）
- ヘルスチェック:
  - GET /health で200
- バックアップ:
  - DB dump（cron想定） + Assetsのバックアップ手順をREADMEに記載

推奨:
- 逆プロキシ（Nginx/Caddy）でTLS終端
- ログは構造化（JSON）して、VPSならjournald/ファイルで回収できる

---

## 10. 実装マイルストーン（推奨）

### Milestone 1: デプロイ可能なスキャフォールド
- Next.js/Node API + Postgres + 認証 + RBAC
- Workspace作成/参加

### Milestone 2: Entity/Article 基本 + リビジョン
- base記事CRUD + revision履歴 + diff/復元

### Milestone 3: Overlay（時代/章/視点）とグローバルフィルタ
- overlay CRUD
- Canon / As Viewpoint / Compare 表示

### Milestone 4: 地図 + ピン（フィルタ連動）
- 地図画像登録、CRS.Simple表示、ピンCRUD、記事リンク

### Milestone 5: 動線 + タイムライン（世界史/ストーリー分離）
- Path（矢印）+ Event CRUD
- timeline type 切替、地図連携

### Milestone 6: レビュー/監査/通知/既読
- ReviewRequest、AuditLog、Watch、Notification、ReadState

### Milestone 7: PDF出力 + LLM統合
- 印刷セット + Puppeteer
- Gemini API / Codex CLI exec + 実行ログ + 安全策（allowlist）

---

## 11. Codexへの開発ルール
- 変更は小さく、必ずlint/testを通す
- DBスキーマ変更は後方互換を意識
- UIは “フィルタの一貫性” を最優先（記事/地図/タイムラインで挙動がズレない）
- LLM出力は必ず下書き扱い、監査ログを残す

---

## 12. 参考（実装時にリンクとして使う: ※URLはコード内のみ記載）
- Leaflet: https://leafletjs.com/
- Leaflet CRS.Simple example: https://leafletjs.com/examples/crs-simple/crs-simple.html
- Leaflet PolylineDecorator: https://github.com/bbecquet/Leaflet.PolylineDecorator
- Mermaid: https://mermaid.js.org/
- Puppeteer PDF: https://pptr.dev/guides/pdf-generation
- OpenAI Codex AGENTS.md: https://developers.openai.com/codex/guides/agents-md
