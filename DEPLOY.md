# Depictionator デプロイガイド（Ubuntu VPS）

目的
- Docker + docker compose で手軽に本番運用できる状態にする。
- `.env` の設定だけで起動できるようにする。

前提
- Ubuntu 22.04+ の VPS
- ドメインがある場合はリバースプロキシで TLS 終端を推奨

1) Docker / Compose のインストール

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

2) リポジトリ取得

```bash
git clone https://github.com/GrEarl/Depictionator.git depictionator
cd depictionator
```

3) 環境変数の準備

```bash
cp .env.example .env
```

`.env` で最低限設定するもの:
- `AUTH_SECRET`: 強いランダム値
- `APP_BASE_URL`: 公開URL (https://your-domain)
- `DATABASE_URL`: compose で `db` を指す設定のままでOK
- LLM を使う場合は `GEMINI_API_KEY` / `VERTEX_GEMINI_*` / `CODEX_CLI_PATH` を設定

4) 起動

```bash
docker compose up -d --build
```

5) ヘルスチェック

```bash
curl http://localhost:3000/health
```

6) TLS 終端（推奨）
- Caddy or Nginx で `APP_BASE_URL` に合わせてリバースプロキシ
- `/health` を使って死活監視

7) Codex CLI の利用（任意）
- VPS 側に `codex` をインストールして PATH に通す
- もしくは `.env` の `CODEX_CLI_PATH` にフルパス指定
- 認証情報は `~/.codex/auth.json` を使用

8) アップデート手順

```bash
git pull

docker compose up -d --build
```

※ 起動時に entrypoint が `prisma migrate deploy` または `prisma db push` を自動実行

9) バックアップ
- DB: `pg_dump` で定期バックアップ
- Assets: compose の `assets-data` ボリュームをスナップショット

10) トラブルシュート
- 起動に失敗したら `docker compose logs -f` を確認
- `.env` の `DATABASE_URL` が `db` を指しているか確認
- `/health` が 200 を返すか確認

