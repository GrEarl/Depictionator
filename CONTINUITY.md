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
- Wiki search panels + Markdown ToC deployed; VPS redeployed with latest MapEditor/Codex fixes; /health OK.

Done:
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

Now:
- Re-run UI check (agent-browser) when app is running; update Gemini.md if new gaps.

Next:
- Run UI check (agent-browser) once app is running; update Gemini.md if new gaps.

Open questions (UNCONFIRMED if needed):
- Are there newer versions than current deps after latest doc check?
- Gemini UI/UX implementation pending.

Working set (files/ids/commands):
- package.json
- package-lock.json
- prisma/schema.prisma
- prisma.config.ts
- src/app/api/llm/execute/route.ts
- src/components/MapEditor.tsx
- src/app/(app)/maps/page.tsx
- src/components/MarkdownToc.tsx
- src/components/WikiArticleImportPanel.tsx
- src/components/WikiMapImportPanel.tsx
- src/lib/markdown.ts
- README.md
- Gemini.md
