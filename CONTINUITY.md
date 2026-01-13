Goal (incl. success criteria):
- Implement all AGENTS.md requirements into a usable system (backend + minimal UI), with robust, foolproof behavior.
- Provide map/diagram visualization primitives (shape/color/type) for clear classification.
- Implement LLM integration switching: Gemini (AI Studio or Vertex) and GPT-5.2 via Codex CLI exec with fixed options.
- Keep VPS-ready deployment (Docker, health, docs) and use git for versioning, with changes pushed to origin.
- Docs and UI display product name as Depictionator; default branch is main.
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
- In progress (rename default branch to main and push).

Done:
- Full Prisma schema + minimal UI/API for entities, articles, overlays, timelines, events, maps, pins, paths, eras, chapters, viewpoints, marker styles, assets.
- Review workflow, audit logging, watch/notifications, read state, unread indicators, mention notifications.
- Revision diff/restore, Markdown renderer + Mermaid, map viewer/editor (Leaflet) with pin/path creation.
- Print set builder endpoint + UI, asset serving, /health endpoint, Docker entrypoint.
- LLM provider switching (Gemini AI Studio/Vertex + GPT-5.2 via Codex CLI), UI inputs, API handling, and env/docs updates.
- Added DEPLOY.md (Ubuntu VPS guide), README updated with repo URL and Depictionator name.
- Ran npm run lint (clean).
- agent-browser validation: /login loads, /maps redirects to /login (no auth).
- Docker CLI not available in environment (could not run docker compose).
- Git push to origin completed.

Now:
- Switch branch to main and push; update remote HEAD if possible.

Next:
- If needed: run docker compose on VPS and complete runtime smoke tests.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- git branch -M main
- git push -u origin main
- git remote set-head origin -a
