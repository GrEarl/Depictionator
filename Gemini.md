# WorldLore Atlas フロントエンド要件（Gemini向け）

目的
- WorldLore Atlas（世界観資料集約アプリ）のUI/UXを完成させる。
- バックエンドは最小UIで機能網羅済み。フロントは「使いやすさ」と「情報の区別」を最優先。

最重要コンセプト（必ずUIに反映）
1) World Time（世界史時間）
2) Story Progress（ストーリー進行）
3) Viewpoint（視点/認識主体）
- 上記3軸が全画面で一貫して効くこと。
- Canon（正史）と Belief（視点情報）を明確に分離表示。

グローバルフィルタ（最重要UI）
- World: Era（必須） + 日付/範囲（任意）
- Story: Chapter（任意）
- Viewpoint: Omni(Canon)/Player/Faction/Character
- 表示モード: Canon / As Viewpoint / Compare（左右分割）
- どの画面でも常時可視、変更が全画面に反映されること。

主要画面（最低限の完成形）
1) ダッシュボード
- ワークスペース切替/参加
- 通知（未読/既読）

2) 記事ビュー
- 左: エンティティ一覧（type/tag/status/全文検索/未読）
- 右: 記事本文（Markdown + Mermaid）
- Revision履歴、diff、復元、レビュー申請
- Compareモード: CanonとViewpointを左右で比較

3) 記事詳細
- Base + Overlay をフィルタ条件で切替
- TruthFlag（canonical/rumor/mistaken/propaganda/unknown）を視覚的に明示

4) 地図ビュー
- 階層地図（世界→地域→都市）
- ピン/動線 CRUD
- マーカー形状・色・タイプ分類を視覚化（MarkerStyle/EventType/LocationType）
- 編集モードと閲覧モードを分離
- フィルタ（World/Story/Viewpoint）連動

5) タイムライン
- タブ: World History / Game Storyline
- Eventに「世界史時刻」と「ストーリー順」を併記
- Event → 地図位置/エンティティへジャンプ

6) レビュー/監査
- Review一覧、コメント、承認/差し戻し
- 監査ログ閲覧

7) 設定
- Viewpoint管理
- Asset管理（ライセンス/クレジット）
- PDF出力（印刷セットビルダー）
- LLM設定

地図UIの必須要件（強調）
- クリックでピン配置/移動、動線描画
- ピン/動線は形状・色・種別の凡例で明示
- Viewpoint/Story進行に応じて即時表示切替

UI/UXの明確化ポイント
- フィルタ状態が常に見える
- Draft/Review/Approvedなどの状態が視覚的に分かる
- Canon/Beliefが混ざらない
- Compareモードは必ず左右分割で比較可能

成果物（Geminiが提供すべきもの）
- React/Next.jsベースのUI実装
- 各画面でグローバルフィルタが一貫して機能
- Map/Timeline/Articleの可視化が統一感を持つ
- 最小操作で「何ができるか」が分かる

補足
- デザインは自由裁量。ただし可読性・操作性を優先。
- AGENTS.md 要件の欠落は禁止。
