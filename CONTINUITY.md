Goal (incl. success criteria):
- Implement all AGENTS.md requirements into a usable system (backend + minimal UI), with robust, foolproof behavior.
- Provide map/diagram visualization primitives (shape/color/type) for clear classification.
- Implement LLM integration switching: Gemini (AI Studio or Vertex) and GPT-5.2 via Codex CLI exec with fixed options.
- Keep VPS-ready deployment (Docker, health, docs) and use git for versioning, including pushing to origin.
- Maintain CONTINUITY.md updates each turn until overall work is complete.

Constraints/Assumptions:
- UI is minimal but must clearly expose required features; frontend polish handled elsewhere.
- Follow AGENTS/ledger instructions; keep non-ASCII only where required.
- No destructive operations; avoid removing unrelated changes.
- Approval policy is never; proceed without asking for escalation.
- Avoid extra user questions; keep responses concise (except brief safety note if needed).

Key decisions:
- Manual Next.js scaffold; Prisma schema models full AGENTS.md domain with soft delete and revisions.
- Leaflet used for maps with MarkerStyle for shape/color differentiation.
- LLM panel stays as draft-only; executions logged; provider switching handled server-side.

State:
- In progress (commit + push remaining).

Done:
- Full Prisma schema + minimal UI/API for entities, articles, overlays, timelines, events, maps, pins, paths, eras, chapters, viewpoints, marker styles, assets.
- Review workflow, audit logging, watch/notifications, read state, unread indicators, mention notifications.
- Revision diff/restore, Markdown renderer + Mermaid, map viewer/editor (Leaflet) with pin/path creation.
- Print set builder endpoint + UI, asset serving, /health endpoint, Docker entrypoint.
- LLM provider switching (Gemini AI Studio/Vertex + GPT-5.2 via Codex CLI), UI inputs, API handling, and env/docs updates.
- Added DEPLOY.md (Ubuntu VPS guide), README updated.
- Ran npm run lint (clean).
- agent-browser validation: /login loads, /maps redirects to /login (no auth).
- Docker CLI not available in environment (could not run docker compose).

Now:
- Commit changes and push to https://github.com/GrEarl/Depictionator.git.

Next:
- Re-check for any remaining AGENTS.md gaps if needed.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- src/components/LLMPanel.tsx
- src/app/api/llm/execute/route.ts
- src/app/(app)/layout.tsx
- src/app/(app)/settings/page.tsx
- src/app/globals.css
- .env.example, README.md, DEPLOY.md
- npm run lint, agent-browser
- git commit, git push origin
