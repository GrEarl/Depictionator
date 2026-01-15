Goal (incl. success criteria):
- Update dependencies and LLM defaults to latest documented versions; redeploy and verify.
- Maintain CONTINUITY.md updates each turn until overall work is complete.

Constraints/Assumptions:
- Use ssh-mcp via Codex MCP; avoid destructive operations without confirmation.
- Avoid extra user questions; keep responses concise.

Key decisions:
- Added explicit Map generic for readStateMap.

State:
- In progress (webpack build forced and alias restored; VPS rebuild pending).

Done:
- Updated Codex CLI streaming to keep error handler through process close.
- Committed and pushed Codex CLI spawn error handling fix.
- Added multi-language Wikipedia fallback resolution helpers.
- Added LLM helper for Gemini/Codex text generation.
- Updated Wikipedia article import to synthesize across languages via LLM.
- Added wiki LLM env settings to .env.example.
- Committed and pushed Wikipedia LLM fallback changes.
- Redeployed VPS after wiki LLM import update.
- Resolved DB auth issue by resetting postgres password to match .env.
- Baselined existing DB with migration 20260114170000_sources_locale.
- App restarted successfully; /health returns ok.
- Manual SQL applied for migration 20260114170000_sources_locale (User.locale + SourceRecord).
- Wiki import LLM path reached; returns 502 without GEMINI_API_KEY (expected).
- GEMINI_API_KEY set on VPS; container recreated.
- LLM import now fails with 404 model not found for v1beta (need api version fallback / model update).
- Updated Gemini defaults to gemini-3 preview and added API version fallback in code.
- Updated .env.example with Gemini v3 preview defaults.
- Committed and pushed Gemini v3 preview fallback changes.
- VPS .env updated (GEMINI_MODEL=gemini-3-flash-preview, GEMINI_API_VERSION=v1, WIKI_LLM_MODEL=gemini-3-flash-preview).
- Docker disk cleanup (container/image prune) to resolve no-space issue.
- Rebuilt and redeployed app; /health OK.
- Wiki LLM import succeeded (HTTP 307 to new article).
- Multi-language SourceRecord count confirmed (11 sources).
- Updated dependencies to latest documented versions (Next.js/React/Puppeteer/Prisma) and added Prisma client output path.
- Updated README LLM section with Gemini v3 preview guidance.
- Regenerated npm lockfile; lint now passes with ESLint 9 flat config.
- Refactored global filters to derive state from URL and update URL via provider.
- Replaced Mermaid random id with useId-based stable id.
- Committed and pushed dependency + lint config updates.
- Added Prisma 7 config file and moved datasource URL out of schema.
- Added pg adapter and Pool wiring in Prisma client.
- Added Prisma adapter dependencies and regenerated lockfile.
- Lint passes after React/ESLint 9 updates.
- Committed and pushed Prisma 7 adapter/config changes.
- Added tsconfig baseUrl to restore @ alias for Next 16.
- Added webpack alias for @ path in next.config.js (caused Turbopack warning).
- Added Turbopack resolveAlias for @ path in next.config.js.
- Switched Turbopack resolveAlias to relative "./src" (did not fix alias resolution).
- Forced Next build/dev to webpack and restored webpack alias.
- Committed and pushed readStateMap type fix.
- Fixed archivedEntities typo and pushed.
- Typed global filter option maps in app layout.
- Typed map read state map source in maps page.
- Typed marker style arrays in maps page.
- Typed map/pin/path/archived map arrays in maps page.
- Guarded null locationType when reading style map.
- Defaulted null path arrowStyle for MapEditor payload.
- Typed dashboard membership list.
- Re-encoded dashboard page to UTF-8.
- Typed dashboard notification list.
- Typed reviews page lists and re-encoded to UTF-8.
- Typed settings page viewpoints/assets and re-encoded to UTF-8.
- Typed timeline page lists and re-encoded to UTF-8.
- Added missing TextDecoder in Gemini stream.
- Typed PDF build route lists and re-encoded to UTF-8.
- Re-encoded multiple files to UTF-8 after PowerShell edits.
- Replaced corrupted dashboard selection string with ASCII.
- Fixed PDF response body typing for NextResponse.
- Typed PDF export route assets and response body.
- Simplified MarkdownView code renderer to avoid inline prop typing error.
- Typed mention notification member list.
- Typed watcher list in notifications helper.
- Added prisma generate in Dockerfile build stage.
- Normalized article entity type to Prisma enum.
- Normalized article status to Prisma enum.
- Normalized event type to Prisma enum in create/update.
- Normalized map bounds JSON typing in create/update.
- Switched map create input to unchecked type for workspaceId.
- Switched map update input to unchecked type for parentMapId.
- Normalized marker style event/location types to enums.
- Normalized marker style target/shape to enums.
- Normalized overlay truthFlag to enum.
- Normalized pin truth/location/shape enums in create/update.
- Normalized path arrowStyle enum in create/update.
- Normalized timeline type enum in create/update.
- Normalized viewpoint type enum in create.
- Fixed audit log meta JSON typing.
- Switched audit log create input to unchecked type.
- Cast mention notification payload to Prisma JSON input.
- Cast notification payloads to Prisma JSON input.
- Added public/.gitkeep to satisfy Docker copy.
- Handled Codex CLI spawn/runtime errors in streaming route.
- Guarded Codex CLI runtime error message typing.
- Pulled latest on VPS, rebuilt Docker image, started containers, and verified /health.
- Browser check (agent-browser): /health OK, /login loads with fields; root / timed out at 10s.
- Added redirect helper and updated API redirects to respect Host/forwarded headers.
- API smoke checks (auth/workspace/article/overlay/viewpoint/timeline/era/chapter/event/map/pin/path) succeeded via curl with session cookie.
- PDF build failed on VPS due to missing Chromium.
- Chromium installed in runner image but puppeteer path misconfigured (symlink loop).
- Fixed Chromium executable path and symlinks; PDF build now returns 200 OK.
- Redeployed VPS after Chromium path fix; /health OK.
- LLM exec endpoints return structured errors when keys/CLI missing.
- Review workflow tested (revision -> review request -> approve).
- Notifications/read-state/watch toggle endpoints tested via API.
- PDF export endpoint returns 200 OK.
- Added Caddy reverse proxy; HTTPS health check returns 200 via internal.copiqta.com.
- HTTPS register redirect sets Secure cookie and redirects to https://internal.copiqta.com/.
- Added Caddy reverse proxy with Cloudflare TLS; domain reachable.
- Added SourceRecord model + User locale enum, plus migration file.
- Added wiki import/search/page endpoints and asset/map/article import.
- Added locale helper and locale setting API.
- Updated PDF build/export to include SourceRecord credits.
- Drafted Gemini.md UI/UX brief.
- Fixed PDF build/export UTF-8 issues after adding Source credits.
- Fixed locale audit workspaceId usage for build.
- Fixed PDF build entity baseRevision typing for SourceRecord credits.

Now:
- Rebuild VPS after webpack build switch.

Next:
- Redeploy VPS and re-verify.

Open questions (UNCONFIRMED if needed):
- Gemini UI/UX implementation pending.

Working set (files/ids/commands):
- src/lib/wiki.ts
- src/lib/llm.ts
- src/app/api/wiki/import/article/route.ts
- .env.example
- package.json
- prisma/schema.prisma
- README.md
- eslint.config.cjs
- src/components/GlobalFilterProvider.tsx
- src/components/GlobalFilters.tsx
- src/components/Mermaid.tsx
