Goal (incl. success criteria):
- Resolve viewport warnings and npm audit vulnerabilities while keeping the build green.

Constraints/Assumptions:
- Use ssh-mcp for VPS actions; avoid destructive operations.
- Avoid extra user questions; keep responses concise.
- Approval policy: on-request. Sandbox: workspace-write.
- Follow updated AGENTS.md; prior instructions in AGENTS_old.md.
- Backend work by Codex; frontend work via Gemini CLI using gemini-3-pro-preview or gemini-3-flash-preview.
- Allowed to use GEMINI_API_KEY from server .env for Gemini CLI runs.
- Deployments/tests must be done via ssh-mcp.
- Read/write files as UTF-8. Use agent-browser for web automation.
- User requests no confirmations; proceed autonomously.
- Code review output must follow JSON schema + priority tagging per review guidelines.

Key decisions:
- Next.js 16 + React 19; Prisma 7 with prisma.config.ts and pg adapter; force webpack for @ alias.
- LLM defaults to Gemini 3 preview with API version fallback; Codex CLI execution remains supported.

State:
- Continuing from prior Depictionator work; current task is to apply requested warnings/vulnerability fixes.

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
- Reviewed git status/diffs for current local changes; identified compile-breaking placeholders/imports in MapEditor/ArticleDetail/AIAssistantClient and missing Tailwind typography dependency.
- Restored MapEditor imports/types and createIcon helper; removed duplicate saveCardsToDatabase declaration.
- Moved ReactMarkdown/remarkGfm to module scope in AIAssistantClient and cleaned corrupted strings.
- Moved next/image import to module scope in ArticleDetail and removed stray JSX imports.
- Added @tailwindcss/typography dependency and ran npm install to update package-lock.json.
- Restored Japanese strings in AIAssistantClient with UTF-8 content.
- Updated all dependencies/devDependencies to latest with npm-check-updates and installed them.
- Fixed build-breaking imports and missing client directives across components.
- Updated Tailwind v4 PostCSS setup and globals.css to use @import "tailwindcss" + @config.
- Implemented LlmPanel submit handler and restored Wiki import panel logic/state.
- Added Prisma driver adapter (PrismaPg) to Prisma client and fixed UTF-8 in prisma.ts.
- npm run build now completes successfully (with Next metadata viewport warnings).
- Moved viewport config to exported viewport in app layout to clear Next warnings.
- Ran npm audit fix --force; vulnerabilities now 0.
- Aligned Prisma to 6.19.2 (client + CLI) and removed adapter usage; regenerated Prisma client.
- npm run build succeeds after Prisma regeneration.

Now:
- Report the fixes and the Prisma version alignment required by npm audit fix.

Next:
- If desired, re-upgrade Prisma to 7.x later with compatible security update.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- CONTINUITY.md
- src/components/MapEditor.tsx
- src/components/AIAssistantClient.tsx
- src/components/ArticleDetail.tsx
- package.json
- package-lock.json
- postcss.config.js
- src/app/globals.css
- src/components/LlmPanel.tsx
- src/components/AIEditAssistant.tsx
- src/components/PerspectiveAnalysisPanel.tsx
- src/components/WikiArticleImportPanel.tsx
- src/components/MapEditor.tsx
- src/components/EvidenceBoardCanvas.tsx
- src/lib/prisma.ts
- src/app/layout.tsx
- npm run build
- npx npm-check-updates -u
- npm install
- npm audit
- npm audit fix --force
- npx prisma generate
