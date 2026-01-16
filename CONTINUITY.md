Goal (incl. success criteria):
- Fully implement AGENTS.md-required Depictionator system with robust backend, deployable to VPS (Docker/Caddy), and stable core flows; map/wiki/LLM/PDF work; /health OK.
- Keep Gemini.md updated with UI/UX requirements and known gaps for Gemini frontend work.
- Fix broken functional UI flows (LLM, locale switcher, workspace open/landing UI) so they work end-to-end, not just visual shells.
- Restore and rebuild Articles feature to be reliable and readable; align with MediaWiki-like editing (stable initial content, revisions, clear UI).

Constraints/Assumptions:
- Use ssh-mcp for VPS actions; avoid destructive operations.
- Avoid extra user questions; keep responses concise.
- Approval policy: on-request. Sandbox: workspace-write.
- Follow updated AGENTS.md; prior instructions in AGENTS_old.md.
- Backend work by Codex; frontend work via Gemini CLI using gemini-3-pro-preview or gemini-3-flash-preview.
- Allowed to use GEMINI_API_KEY from server .env for Gemini CLI runs.
- Deployments/tests must be done via ssh-mcp.
- Read/write files as UTF-8. Use agent-browser for web automation.
- User requests no confirmations; proceed autonomously and avoid handing back turn until AGENTS.md-level backend work is complete (note: will still respond per system constraints).

Key decisions:
- Next.js 16 + React 19; Prisma 7 with prisma.config.ts and pg adapter; force webpack for @ alias.
- LLM defaults to Gemini 3 preview with API version fallback; Codex CLI execution remains supported.

State:
- Core backend/features mostly implemented; Codex CLI spawn/runtime error handling fixed and pushed in streaming LLM route.
- VPS rebuild completed; app container recreated and /health returns 200.
- Added server-side list filters for Articles/Maps/Timeline (query/type/status/tags/unread/event type) and preserved global filter params across views.
- Latest filter-related typing fixes deployed; /health OK.
- Gemini CLI requests timed out; UI/UX guidance will be updated manually in Gemini.md.
- Gemini CLI ran directly (no MCP) and output appended to Gemini.md.
- Gemini UI shell/editor changes committed and pushed; pending VPS deploy.
- MapEditor implicit any typing fix committed and pushed.
- Local repo clean; VPS deploy for Gemini UI changes completed; /health 200.
- Comprehensive UI/UX refactor landed locally; verified files present and cleaned invalid UTF-8/emoji artifacts.
- UI refactor deployed to VPS; /health 200 after rebuild and container restart.
- User says current implementation is mock-level; expects production-grade backend per AGENTS.md.
- Added schema + migration for MapLayer/MapScene/EvidenceBoard/EvidenceItem/EvidenceLink/Reference/Citation and layerId on Pin/Path.
- Added API routes for map layers/scenes, evidence boards/items/links, references/citations, viewpoint update, overlay update; tightened overlay validation and overlay revision permissions.
- Fixed Prisma schema by adding Viewpoint->MapScene relation; removed BOM from migration file.
- VPS deploy: rebuilt app image, handled Prisma migration failure (BOM/failed row), manually reconciled _prisma_migrations, app restarted, /health OK.
- Added article create/update validations for story intro chapter, entity watcher notifications on update/delete; deployed and /health OK.
- Added Wikimedia SVG map import support via imageUrl parsing (commons File: URLs) and committed/pushed.
- VPS deploy for SVG import change completed; rebuilt app image, restarted stack, /health OK.
- Addressing broken UI flows: implementing workspace open flow, locale switching with i18n copy, LLM panel error handling, and missing CSS classes.
- Fixed i18n typing (UiCopy) and option typing in app layout; VPS redeploy completed; /health OK.
- Gemini CLI run (using server .env key) reviewed locale/LLM/workspace flows; suggestions matched current implementation (no new code changes).
- Investigating Wiki map image import "Page not found" for Commons File URLs.
- Wiki page import fix deployed; VPS disk cleanup (docker prune) performed to resolve out-of-space build failures; /health OK after redeploy.
- User reports Articles feature broken: initial content wiped, UI unreadable; needs MediaWiki-level rebuild.
- Article create now auto-approves initial revision and sets baseRevisionId (committed).
- Revisions create route auto-approves base edits, sets parent revision, updates baseRevisionId, notifies watchers, and fixes overlay redirect (committed).
- Gemini CLI updated ArticleDetail/MarkdownEditor/globals.css for read/edit/history/compare UX and typography; fixed garbled text and overlay status (committed).
- MarkdownEditor now includes hidden input in preview mode to prevent bodyMd loss on submit.
- Article fixes committed and pushed; VPS rebuild via docker-compose completed (timeout during build but services up); /health 200.
- 2026-01-16: User reported bad gateway; app container had exited. Resolved by docker-compose down/up --build; services up; /health 200.
- 2026-01-16: User reports all import features and dialogs are broken/insufficient; needs full fix.

Done:
- Read updated AGENTS.md with UTF-8 output; reviewed AGENTS_old.md for prior guidance.
- Created migration `20260115123000_board_layers_refs` with new enums/tables and Pin/Path layerId.
- Updated Prisma schema for new models/enums and relations (map layers/scenes, evidence boards, references/citations).
- Added layerId support in pin/path create/update; archive/restore now handles new model types.
- Added map layer/scene API endpoints; evidence board/item/link endpoints; reference/citation endpoints; viewpoint update; overlay update.
- Enforced reviewer role for overlay revisions (create/submit/restore) and validated overlay viewpoint/chapter references.
- Fixed Prisma validation error by adding MapScene relation on Viewpoint; pushed.
- Removed BOM from migration file; pushed.
- VPS: git pull, rebuild/restart, resolved migration failure (BOM + failed migration rows), migrations applied, app healthy.
- Hardened article create/update/delete with chapter validation + watcher notifications; deployed and /health OK.
- Added Wikimedia SVG map URL import support (imageUrl + parseWikiImageInput) and pushed.
- VPS: rebuilt/restarted for SVG import change; /health OK.
- Added i18n dictionary and wired locale to root layout, app layout, sidebar, global filters, dashboard, and workspace landing page.
- Added workspace open API route and wired dashboard/workspace links to set active workspace before navigation.
- Improved LLM panel error handling for JSON errors.
- Added dashboard/link-grid/link-card CSS to stabilize workspace landing UI.
- Fixed TypeScript build errors from i18n literal types and filter options.
- VPS: rebuilt app image, handled ContainerConfig error via down/up, /health OK.
- VPS: rebuilt app image after LLM stream fix; removed stale container (ContainerConfig error) and restarted app; /health 200.
- Codex CLI streaming now handles spawn/runtime errors without crashing and returns structured errors.
- Article list filtering (search/type/status/tags/unread) + LLM context updated.
- Map overview filtering (search/unread) + LLM context updated.
- Timeline event filtering (search/event type) + tab links preserve filters.
- Fixed Prisma enum typing for article filters and timeline filters; redeployed to VPS.
- VPS: rebuild completed; removed stale container and restarted app; /health 200.
- Appended manual UI/UX directives to Gemini.md after Gemini CLI timeouts.
- Appended direct Gemini CLI UI/UX directives (gemini-3-pro-preview) to Gemini.md.
- LLM exec error handling in streaming route; wiki import with multi-language + SourceRecord credits.
- Locale support, LLM env settings, PDF credits; Chromium path fix for PDF generation.
- Caddy reverse proxy + HTTPS health OK; API smoke checks completed; PDF export OK.
- Dependency updates to latest docs; lint/TS fixes; Prisma 7 adapter/config; lockfile refreshed.
- Drafted Gemini.md UI/UX brief; ran Gemini CLI review and added findings.
- LLM context coverage expanded to dashboard/reviews/settings/workspace/revision pages.
- Added MarkdownEditor, Markdown ToC, wiki import panels, map legend/layer toggles.
- VPS rebuilt/redeployed with latest UI scaffolding; /health OK.
- Hardened Codex CLI streaming errors (runtime errors emit structured JSON).
- MapEditor: pin edit toggle, drag-to-update, pin metadata fields, event legend, path undo.
- Updated Gemini.md with latest UI scaffolding notes.
- Local UI check attempt: localhost /health unreachable (server not running).
- Committed and pushed latest MapEditor + Codex stream fixes.
- VPS: git pull + docker-compose up --build (timed out but containers up); /health 200.
- Agent-browser UI check on internal.copiqta.com (Dashboard/Maps) completed; notes added to Gemini.md.
- MapEditor SSR crash fixed via dynamic import; 502 resolved after redeploy (removed stale container).
- Agent-browser UI checks completed for Articles/Timeline/Reviews/Settings; notes added to Gemini.md.
- Gemini UI changes committed: new Sidebar/LocaleSwitcher/ArticleDetail, layout + CSS refresh, MapEditor toolbar updates.
- MapEditor implicit-any typing fix committed and pushed.
- VPS: rebuild completed for Gemini UI changes; stale app container removed; redeployed successfully.
- VPS: Postgres password reset to match .env; Prisma migrate deploy succeeded; /health 200.
- Agent-browser UI check completed on internal.copiqta.com (login/workspace/articles/maps/timeline/settings).
- Appended new UI findings and action items to Gemini.md.
- Created UI test user (uitester+depictionator@example.com) and workspace "Demo" on deployed instance during UI check.
- Rewrote Maps/Settings/Reviews pages to ASCII-safe content and fixed corrupted markup.
- Updated Timeline page to preserve global params, add search, and remove unused imports.
- Added VisualTimeline component with ASCII-only metadata labels.
- Fixed UI refactor imports to use "@/lib/auth" after build failure for "@/auth".
- VPS: rebuilt app image for UI refactor, removed stale container, redeployed successfully; /health 200.
- Added parseWikiPageInput and Commons URL handling for /api/wiki/page; File: pages now include themselves in image list.
- VPS: freed disk space (container/image prune) after build ran out of space; rebuilt app image; ContainerConfig error resolved via down/up; /health OK.
- ArticleDetail UI now has Read/Edit/History/Compare tabs with revision fallback and compare view; MarkdownEditor now supports write/split/preview.
- Article read view typography improved (line length, headings, lists, blockquotes, code).
- Deployed article fixes to VPS; services running and /health 200.
- Bad gateway incident resolved by full docker-compose restart; app/proxy/db running; /health 200.

Now:
- Audit import flows (Wiki article/map/image, assets) and import dialogs; fix backend + frontend and redeploy.

Next:
- Use Gemini CLI for import dialog/frontend fixes; adjust API routes as needed; redeploy via ssh-mcp.

Open questions (UNCONFIRMED if needed):
- Which import entries are failing (Wiki article import, map import, image import, file upload) is UNCONFIRMED; will verify in UI and logs.

Working set (files/ids/commands):
- package.json
- package-lock.json
- prisma/schema.prisma
- prisma/migrations/20260115123000_board_layers_refs/migration.sql
- prisma.config.ts
- src/app/api/llm/execute/route.ts
- /root/build_llm_fix.log (VPS)
- tmux session: build_llm_fix
- src/components/MapEditor.tsx
- src/app/(app)/maps/page.tsx
- src/components/MarkdownToc.tsx
- src/components/WikiArticleImportPanel.tsx
- src/components/WikiMapImportPanel.tsx
- src/lib/markdown.ts
- README.md
- Gemini.md
- /root/build_ui_refactor2.log (VPS)
- tmux session: build_ui_refactor2
- src/lib/wiki.ts
- src/app/api/wiki/import/map/route.ts
- /root/build_svg.log (VPS)
- tmux session: build_svg
- src/lib/i18n.ts
- src/app/layout.tsx
- src/app/(app)/layout.tsx
- src/components/Sidebar.tsx
- src/components/GlobalFilters.tsx
- src/components/LocaleSwitcher.tsx
- src/components/LlmPanel.tsx
- src/app/(app)/page.tsx
- src/app/(app)/workspaces/[slug]/page.tsx
- src/app/api/workspaces/open/route.ts
- src/app/globals.css
- src/app/api/articles/create/route.ts
- src/app/api/revisions/create/route.ts
- src/components/ArticleDetail.tsx
- src/components/MarkdownEditor.tsx
