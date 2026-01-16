# Depictionator - デプロイ手順

## 🚀 サーバーデプロイ（SSH-MCP経由）

### 前提条件
- サーバーにSSH接続可能
- Docker & Docker Composeがインストール済み
- Gitリポジトリへのアクセス権限

### Step 1: サーバーに接続してリポジトリをクローン/プル

```bash
# サーバーにSSH接続
ssh user@your-server

# リポジトリをクローン（初回のみ）
git clone https://github.com/GrEarl/Depictionator.git depictionator
cd depictionator

# または既存リポジトリをプル
cd depictionator
git pull origin main
```

### Step 2: 環境変数を設定

```bash
# .envファイルを作成
cp .env.example .env

# .envを編集
nano .env
```

**重要な設定項目：**
```bash
# ランダムな秘密鍵を生成
AUTH_SECRET="$(openssl rand -base64 32)"

# 公開URL（サーバーのドメイン）
APP_BASE_URL="https://your-domain.com"

# Gemini APIキー（オプション）
GEMINI_API_KEY="your-api-key-here"

# データベース設定（デフォルトでOK）
DATABASE_URL="postgresql://postgres:postgres@db:5432/worldlore?schema=public"
```

### Step 3: Docker Composeでビルド＆起動

```bash
# ビルドして起動
docker compose up -d --build

# ログを確認
docker compose logs -f app
```

### Step 4: マイグレーション実行

```bash
# コンテナ内でマイグレーション実行
docker compose exec app npx prisma migrate deploy

# または、prisma db pushを使用
docker compose exec app npx prisma db push
```

### Step 5: 動作確認

```bash
# ヘルスチェック
curl http://localhost:3000/health

# またはブラウザで確認
# http://your-server-ip:3000
```

---

## 📦 新機能デプロイ後の確認項目

### 地図統合機能のテスト

1. **ワークスペース選択**
   - ダッシュボードでワークスペースを選択

2. **地図画面で証拠カード配置**
   - `/maps` にアクセス
   - 右サイドバーの「Entities」タブを選択
   - 📋 Cardモードをクリック
   - エンティティを地図上にドラッグ＆ドロップ
   - カードが地図上に配置されることを確認

3. **カード間の接続**
   - カードの 🔗 ボタンをクリック
   - 別のカードをクリックして接続
   - オレンジの線が引かれることを確認

4. **カードの保存**
   - 💾 Save ボタンをクリック
   - 「Cards saved successfully!」と表示されることを確認
   - ページをリロードしてもカードが残っていることを確認

5. **Event自動配置**
   - ⏱️ Auto Timeline ボタンをクリック
   - Eventが時系列順に配置されることを確認

---

## 🔄 更新時のデプロイ

```bash
# サーバーで実行
cd depictionator
git pull origin main
docker compose down
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

---

## 🐛 トラブルシューティング

### データベース接続エラー

```bash
# DBコンテナの状態確認
docker compose ps db

# DBコンテナのログ確認
docker compose logs db

# DBコンテナを再起動
docker compose restart db
```

### マイグレーションエラー

```bash
# マイグレーション状態を確認
docker compose exec app npx prisma migrate status

# 強制的にスキーマを同期（開発環境のみ）
docker compose exec app npx prisma db push --force-reset
```

### ポート競合エラー

```bash
# ポート3000を使用しているプロセスを確認
sudo lsof -i :3000

# 別のポートを使用する場合（docker-compose.ymlを編集）
ports:
  - "8080:3000"  # ホストの8080ポートにマッピング
```

---

## 🎯 本番運用のベストプラクティス

1. **リバースプロキシの設定**
   - Nginx/Caddyでリバースプロキシを設定
   - SSL証明書（Let's Encrypt）を設定

2. **バックアップ**
   ```bash
   # データベースバックアップ
   docker compose exec db pg_dump -U postgres worldlore > backup_$(date +%Y%m%d).sql

   # Assetsバックアップ
   docker volume inspect depictionator_assets-data
   ```

3. **ログ監視**
   ```bash
   # アプリケーションログ
   docker compose logs -f --tail=100 app

   # エラーログのみ
   docker compose logs -f app | grep -i error
   ```

4. **リソース監視**
   ```bash
   # Dockerコンテナのリソース使用状況
   docker stats
   ```

---

## ✅ デプロイチェックリスト

- [ ] .envファイルを作成・設定
- [ ] AUTH_SECRETをランダム値に設定
- [ ] APP_BASE_URLを正しいドメインに設定
- [ ] Docker composeでビルド・起動
- [ ] マイグレーション実行
- [ ] ヘルスチェックOK
- [ ] ブラウザでアクセス確認
- [ ] 地図画面でカード配置テスト
- [ ] カード保存・読み込みテスト
- [ ] SSL設定（本番環境）
- [ ] バックアップ設定

---

## 🔗 関連ドキュメント

- [README.md](./README.md) - 基本セットアップ
- [AGENTS.md](./AGENTS.md) - 機能仕様・開発ガイド
- [DEPLOY.md](./DEPLOY.md) - Ubuntu VPSデプロイガイド

---

**デプロイ完了後、何か問題があれば上記のトラブルシューティングを参照してください！** 🎉
