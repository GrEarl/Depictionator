Goal (incl. success criteria):
- Fix Codex CLI streaming spawn error handling regression.
- Maintain CONTINUITY.md updates each turn until overall work is complete.

Constraints/Assumptions:
- Use ssh-mcp via Codex MCP; avoid destructive operations without confirmation.
- Avoid extra user questions; keep responses concise.

Key decisions:
- Added explicit Map generic for readStateMap.

State:
- In progress (Codex CLI spawn error handling fix applied; pending commit/push).

Done:
- Updated Codex CLI streaming to keep error handler through process close.
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
- Commit/push Codex CLI spawn error handling fix.

Next:
- Redeploy and re-verify after push.

Open questions (UNCONFIRMED if needed):
- Gemini UI/UX implementation pending.

Working set (files/ids/commands):
- src/app/api/llm/execute/route.ts
