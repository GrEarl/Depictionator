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
- In progress (major CRUD coverage added; remaining features still pending).

Done:
- Added LLM logging model and LLM execute endpoint + global panel.
- Added Articles CRUD (entity create/archive, base/overlay drafts, review submit/approve/reject) with minimal UI.
- Added Timeline CRUD (timelines, eras, chapters, events) with minimal UI.
- Added Map CRUD (maps, pins, paths) with marker styles UI.
- Added notifications, watch toggle, read-state endpoints + dashboard notification list.
- Added asset upload endpoint (local storage) and settings UI.
- Added PDF export endpoint using Puppeteer and settings UI.
- Updated global filters to sync to URL.
- Installed Puppeteer, ran prisma generate and lint successfully.

Now:
- Continue implementing remaining AGENTS.md features: RBAC enforcement across all endpoints, audit logs for all mutations, overlays filtering by time/chapters, diff/history UI, watch/notification triggers on updates, PDF credit inclusion, LLM exec allowlist, and any missing CRUD.

Next:
- Add missing CRUD for Viewpoints listing, Entities updates, Map/Event linking, Review assignments/comments UI, and soft-delete safeguards.
- Ensure global filter affects map/timeline overlays consistently.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- prisma/schema.prisma
- src/lib/api.ts, src/lib/rbac.ts, src/lib/audit.ts, src/lib/workspaces.ts, src/lib/forms.ts, src/lib/notifications.ts
- src/app/(app)/* pages, src/app/api/* (articles, reviews, maps, timelines, markers, assets, pdf, llm)
- src/components/LlmPanel.tsx, GlobalFilters, GlobalFilterProvider
- package.json, package-lock.json, README.md, .env.example, docker-compose.yml
- npx prisma generate, npm run lint
