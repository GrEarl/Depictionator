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





## Map Editor Features (Figma-Style UX)

The new map editor provides a professional, designer-friendly experience:

### Screen Structure
- **/maps** - Grid/list view of all maps with preview thumbnails
- **/maps/[id]** - Fullscreen Figma-style editor for individual maps
- Separated creation/import/editing workflows for maximum canvas space

### Editor Layout (Figma-inspired)
- **Top Toolbar**: Mode selection (Select/Pin/Path), zoom controls, back navigation
- **Left Sidebar**: Layers panel + drag-and-drop entity list
- **Main Canvas**: Full-screen Leaflet map with proper coordinate handling
- **Right Panel**: Context-sensitive properties (appears when pin/path selected)

### Tools & Shortcuts
- **V** - Select/Move mode (default)
- **P** - Pin placement mode
- **L** - Path drawing mode
- **Esc** - Cancel current operation, return to select mode
- **Arrow Keys** - Pan the map
- **Drag entities** from sidebar → auto-create pins at drop location

### Fixed Issues
✅ Tools no longer appear outside map bounds (proper coordinate conversion)
✅ Inspector panels are fixed UI elements, not canvas overlays
✅ Map display is fullscreen (not cramped by surrounding UI)
✅ Intuitive mode switching with visual feedback
✅ Keyboard-first workflow for power users

### Design Philosophy
- **Zero training required**: Visual affordances guide users naturally
- **Direct manipulation**: Drag entities, click to place, immediate feedback
- **Personas-inspired aesthetics**: Bold typography, vibrant accents, game-like polish

