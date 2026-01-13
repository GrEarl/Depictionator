Goal (incl. success criteria):
- Fully implement all AGENTS.md requirements into a usable system (backend + minimal UI), with robust, foolproof behavior.
- Add map/diagram visualization primitives (shape/color/type) and other necessary classification features.
- Use git for versioning of changes in this workspace.
- Maintain CONTINUITY.md updates each turn until the overall work is complete.

Constraints/Assumptions:
- UI should be minimal but clearly indicate required features; frontend polish will be handled elsewhere.
- Follow AGENTS/ledger instructions; keep non-ASCII only where required by source content.
- No destructive operations; avoid removing unrelated changes.
- Approval policy is never; proceed without asking for escalation.

Key decisions:
- Use git commits to record changes going forward.
- Manual Next.js scaffold instead of create-next-app (directory name had uppercase, causing npm name restriction).
- Implement full Prisma schema to relate all entities per AGENTS.md, then build minimal UI/API shell for each area.
- Add map visualization primitives via MarkerStyle + event/location types for shape/color differentiation.

State:
- In progress (expanded CRUD + filtering + soft-delete/restore coverage; remaining gaps still pending).

Done:
- Added soft-delete fields across major models (overlays, viewpoints, timelines, eras, chapters, pins, paths, assets, marker styles).
- Added archive/restore API routes with workspace-scoped safety checks.
- Added more robust CRUD validation for revisions/reviews/events/maps/pins/paths.
- Added review assignments endpoint + UI; watcher/notification helpers + watch/read endpoints.
- Added global filter options sourced from DB; filters now sync via URL and apply to maps/timeline/overlays.
- Added PDF export with credits inclusion and LLM panel endpoint updates.
- Added marker-style, map, pin, path, timeline archive/restore controls in UI.
- Ran prisma generate and lint successfully.

Now:
- Finish remaining AGENTS.md requirements: complete CRUD (updates), review comments UI, audit coverage for all mutations, link entities to maps/events, and strengthen filter consistency.

Next:
- Implement update/edit endpoints for core models and minimal UI to edit existing records.
- Add PDF credit aggregation improvements and LLM allowlist enforcement.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- prisma/schema.prisma
- src/lib/* (api, rbac, audit, notifications, forms)
- src/app/(app)/* pages (articles/maps/timeline/reviews/settings)
- src/app/api/* (archive/restore, CRUD, llm, pdf)
- src/components/*
- npx prisma generate, npm run lint
