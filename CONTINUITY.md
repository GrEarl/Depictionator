Goal (incl. success criteria):
- Perform end-to-end smoke checks against AGENTS.md features (register/login/workspace/entity/article/map/timeline/review/LLM/PDF).
- Maintain CONTINUITY.md updates each turn until overall work is complete.

Constraints/Assumptions:
- Use ssh-mcp via Codex MCP; avoid destructive operations without confirmation.
- Avoid extra user questions; keep responses concise.

Key decisions:
- Added explicit Map generic for readStateMap.

State:
- In progress (PDF build failing due to missing Chromium; adding runtime deps).

Done:
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

Now:
- Add Chromium deps to Dockerfile, redeploy, re-test PDF build.

Next:
- Resume UI/API smoke checks after redeploy.

Open questions (UNCONFIRMED if needed):
- PDF build success after Chromium install is UNCONFIRMED.

Working set (files/ids/commands):
- src/app/api/llm/execute/route.ts
- ssh-mcp deploy commands
