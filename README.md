# Depictionator

Worldbuilding atlas for game development teams. This repo follows the rules in `AGENTS.md`.

## Quick start (local)

1) Copy env file:

```bash
cp .env.example .env
```

2) Start Postgres:

```bash
docker-compose up -d db
```

3) Install deps + generate Prisma client:

```bash
npm install
npx prisma generate
```

4) Run migrations and dev server:

```bash
npx prisma migrate dev --name init
npm run dev
```

5) Health check:

```bash
curl http://localhost:3000/health
```

## Docker (app + db)

```bash
docker compose up --build
```

## Ubuntu VPS deployment (easy)
Detailed guide: see `DEPLOY.md`.

1) Install Docker + Compose:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

2) Clone and configure:

```bash
git clone https://github.com/GrEarl/Depictionator.git depictionator
cd depictionator
cp .env.example .env
```

Edit `.env`:
- Set `AUTH_SECRET` to a strong random value.
- Set `APP_BASE_URL` to your public URL (e.g. https://your-domain).
- Configure LLM providers/keys as needed (see LLM section).
- Keep `DATABASE_URL` pointing at `db` for compose (default is fine).

3) Build + start:

```bash
docker compose up -d --build
```

4) Verify:

```bash
curl http://localhost:3000/health
```

Notes:
- The container entrypoint runs `prisma migrate deploy` if migrations exist; otherwise it runs `prisma db push` automatically.
- Assets are stored in the `assets-data` volume; DB in `db-data`.

## LLM

- Enable providers with `LLM_PROVIDERS_ENABLED` (comma list: `gemini_ai`, `gemini_vertex`, `codex_cli`) and choose
  a default with `LLM_DEFAULT_PROVIDER`.
- Gemini (AI Studio): set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` (e.g. `gemini-3-flash-preview` or `gemini-3-pro-preview`).
  You can override API versions with `GEMINI_API_VERSION` and `GEMINI_API_VERSION_FALLBACK`.
- Gemini (Vertex): set `VERTEX_GEMINI_API_KEY`, `VERTEX_GEMINI_PROJECT`, `VERTEX_GEMINI_LOCATION`,
  and optionally `VERTEX_GEMINI_MODEL`. You can override API versions with
  `VERTEX_GEMINI_API_VERSION` and `VERTEX_GEMINI_API_VERSION_FALLBACK`.
- Codex CLI: ensure `codex` is installed and available (override path with `CODEX_CLI_PATH`), and optional
  timeout via `CODEX_EXEC_TIMEOUT_MS`. The app can accept a base64 `auth.json` per request or use the default
  `~/.codex/auth.json`.

## Backups

- Database (example):

```bash
pg_dump -h localhost -U postgres -d worldlore > backup.sql
```

- Assets: stored under the Docker volume `assets-data` (mounted at `/app/storage`). Snapshot or export that volume alongside DB backups.

## Notes

- This is an MVP scaffold with minimal UI and full backend endpoints for core features.
- PDF export uses Puppeteer in `/api/pdf/export`.




