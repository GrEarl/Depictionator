Goal (incl. success criteria):
- Fully implement AGENTS.md-required Depictionator system with robust backend, deployable to VPS (Docker/Caddy), and stable core flows; map/wiki/LLM/PDF work; /health OK.
- Keep Gemini.md updated with UI/UX requirements and known gaps for Gemini frontend work.

Constraints/Assumptions:
- Use ssh-mcp for VPS actions; avoid destructive operations.
- Avoid extra user questions; keep responses concise.
- Approval policy: never. Sandbox: danger-full-access.

Key decisions:
- Next.js 16 + React 19; Prisma 7 with prisma.config.ts and pg adapter; force webpack for @ alias.
- LLM defaults to Gemini 3 preview with API version fallback; Codex CLI execution remains supported.

State:
- Core backend/features mostly implemented; Codex CLI spawn/runtime error handling fixed and pushed in streaming LLM route.
- VPS rebuild completed; app container recreated and /health returns 200.
- Added server-side list filters for Articles/Maps/Timeline (query/type/status/tags/unread/event type) and preserved global filter params across views.
- Latest filter-related typing fixes deployed; /health OK.
- Gemini CLI requests timed out; UI/UX guidance will be updated manually in Gemini.md.

Done:
- VPS: rebuilt app image after LLM stream fix; removed stale container (ContainerConfig error) and restarted app; /health 200.
- Codex CLI streaming now handles spawn/runtime errors without crashing and returns structured errors.
- Article list filtering (search/type/status/tags/unread) + LLM context updated.
- Map overview filtering (search/unread) + LLM context updated.
- Timeline event filtering (search/event type) + tab links preserve filters.
- Fixed Prisma enum typing for article filters and timeline filters; redeployed to VPS.
- VPS: rebuild completed; removed stale container and restarted app; /health 200.
- Appended manual UI/UX directives to Gemini.md after Gemini CLI timeouts.
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

Now:
- Use Gemini CLI to generate UI/UX improvement directives and update Gemini.md.
- Update Gemini.md manually with UI/UX directives due to CLI timeout.
 - Report CLI timeout and updated Gemini.md to user.

Next:
- Re-check VPS app health/logs if new changes land.
- Update Gemini.md if new UI findings emerge.

Open questions (UNCONFIRMED if needed):
- Are there newer versions than current deps after latest doc check?
- Gemini UI/UX implementation pending.

Working set (files/ids/commands):
- package.json
- package-lock.json
- prisma/schema.prisma
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
- /root/build_filters5.log (VPS)
