# WorldLore Atlas フロントエンド外注ブリーフ（Gemini向け）

目的:
- WorldLore Atlas（世界観設定・資料集約アプリ）の最適なUI/UXを設計・実装してほしい。
- 既存のバックエンドは最小UIで機能を網羅済み。UIは「使いやすさ」「一貫したフィルタ」「編集導線の明確化」を重視。

必須要件（AGENTS.md要約）
- グローバルフィルタ（最重要）: World（Era/日付範囲）、Story（章/シーン）、Viewpoint（Canon/Player/Faction/Character）、表示モード（Canon / As Viewpoint / Compare）
- Canon と Belief（視点情報）の分離表示
- World Time と Story Progress の分離表示
- 記事・地図・タイムラインでフィルタ状態が常に一致
- 監査ログ、レビュー（承認/差戻し）、通知/既読/未読、ウォッチ
- 地図（階層、ピン、動線）+ タイムライン（世界史/ストーリー）
- PDF出力（印刷セット）
- LLMパネル（Gemini/Codex CLI）

画面/機能一覧（最低限）
1) ダッシュボード
   - ワークスペース切替/参加
   - 通知一覧（未読/既読）
2) 記事一覧
   - 左：エンティティ一覧（type/tag/status/検索/未読）
   - 右：本文（Markdown+Mermaid）
   - Revision 履歴/差分/復元、Review 申請
   - Compareモード（Canon vs Viewpoint を左右比較）
3) 記事詳細
   - Base + Overlay 表示（視点別・時代/章により切替）
   - TruthFlag（canonical/rumor/mistaken/propaganda/unknown）表示
4) 地図ビュー
   - 階層地図（世界→地域→都市）
   - ピン/動線 CRUD（クリック操作 + 手入力）
   - マーカー形状/色/タイプ別の凡例
   - フィルタ連動（Viewpoint/World/Story）
5) タイムライン
   - タブ：World History / Game Storyline
   - Eventに世界時刻とストーリー順を両方持たせて表示
6) レビュー/監査
   - Review一覧、コメント、承認/差戻し
7) 設定
   - Viewpoint管理
   - Asset管理（ライセンス/クレジット）
   - PDF出力（印刷セットビルダー）
   - LLM設定

UI/UX 方針
- 最小構成でも「何ができるか一目でわかる」UIにする。
- 「グローバルフィルタ」が常に見える/切り替えしやすい配置。
- 記事・地図・タイムラインの切替導線は明確に。
- Compareモードは左右2カラムで分割表示（CanonとViewpoint）。
- Map/Timelineは凡例とフィルタの適用状況を明確に表示。

地図UIの要件（重要）
- ピン/動線の形状・色分け（MarkerStyle, EventType, LocationType）を視覚化
- クリックでピン配置/移動、動線描画
- 編集モードと閲覧モードを分離（誤操作防止）
- ViewpointやStory進行によって「見せる/隠す」を即時反映

技術的前提（バックエンド/DB）
- Next.js + Prisma（すでに実装済）
- APIは form POST を中心にあるが、UI側で fetch 呼び出しも可
- ソフトデリート前提（削除は復元可能）
- Assetsは storage/ に保存、/api/assets/file/:id で参照可能

デザイン要求（自由裁量）
- 簡素でも良いが、情報の区別（Canon/Belief, World/Story, Viewpoint）が直感的に分かること。
- 使う色は抑えめでも良い。必要なら色を決めてよい。
- アイコン/ラベルで状態（Draft/Review/Approved）を明示。
- 表示密度は高すぎず低すぎず、チーム運用向け。

成果物の期待
- 実装可能なReact/Next.js UI
- Map/Timeline/Articleで同じフィルタが効いていることが明確
- 主要操作が「迷わずクリックできる」配置

追加の注意
- フロント実装はユーザー体験が最優先。バックエンドは既に最小機能が入っているためUIは大胆に再設計して良い。
- ただし、AGENTS.mdの要件を欠落させないこと。
