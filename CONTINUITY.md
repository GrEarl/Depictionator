Goal (incl. success criteria):
- Keep Depictionator aligned with latest official docs/packages; build passes; VPS deploy works; /health OK; key flows (auth/wiki import/LLM/PDF) operate.
- Maintain continuity ledger and provide UI requirements for Gemini (Gemini.md).

Constraints/Assumptions:
- Use ssh-mcp for VPS actions; avoid destructive operations.
- Avoid extra user questions; keep responses concise.
- Approval policy: never. Sandbox: danger-full-access.

Key decisions:
- Next.js 16 + React 19; Prisma 7 with prisma.config.ts and pg adapter; force webpack for @ alias.
- LLM defaults to Gemini 3 preview with API version fallback; Codex CLI execution remains supported.

State:
- UI scaffolding updates deployed to VPS; /health OK.

Done:
- LLM exec error handling in streaming route; wiki import with multi-language + SourceRecord credits.
- Locale support, LLM env settings, PDF credits; Chromium path fix for PDF generation.
- Caddy reverse proxy + HTTPS health OK; API smoke checks completed; PDF export OK.
- Dependency updates to latest docs; lint/TS fixes; Prisma 7 adapter/config; lockfile refreshed.
- Drafted Gemini.md UI/UX brief.
- Verified latest docs (Next.js/React/Prisma/Puppeteer/Gemini); updated Prisma to 7.2.0 and Puppeteer to 24.35.0.
- Enabled Codex CLI search flag in LLM execution paths.
- Rewrote Gemini.md in UTF-8 and added multi-language wiki import UX notes.
- Identified Prisma migrate deploy failure due to missing prisma.config.ts in runtime image.
- Deployed Dockerfile fix; rebuilt image and restarted containers; /health OK.
- VPS .env updated with provided Gemini API key + LLM defaults; containers restarted.
- UI flow verified (register/login/workspace/articles/maps/timeline) via chrome-devtools (agent-browser CLI hung).
- Wiki search and LLM import OK (307 redirect). PDF export OK. LLM execute OK.
- Ran Gemini CLI (text) UX review; captured key findings in Gemini.md.
- Ran Gemini CLI with gemini-3-pro-preview; appended high-priority UI changes to Gemini.md.
- Updated LlmPanel/Layout fallback models to gemini-3-flash-preview; pushed.
- Added LLM context coverage to dashboard/reviews/settings/workspace/revision pages.
- Added wiki import forms to Articles/Maps pages.
- Fixed garbled UTF-8 strings in reviews/settings UI.
- VPS rebuilt/redeployed with UI scaffolding changes; /health OK.

Now:
- Respond with status; await further tasks.

Next:
- Update Gemini.md if UI requirements changed; re-run UI checks with agent-browser if needed.

Open questions (UNCONFIRMED if needed):
- Are there newer versions than current deps after latest doc check?
- Gemini UI/UX implementation pending.

Working set (files/ids/commands):
- /root/depictionator/build.log
- package.json
- package-lock.json
- prisma/schema.prisma
- prisma.config.ts
- src/lib/llm.ts
- src/lib/wiki.ts
- src/app/api/llm/execute/route.ts
- src/app/api/wiki/import/article/route.ts
- README.md
- Gemini.md

