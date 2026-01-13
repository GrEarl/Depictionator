Goal (incl. success criteria):
- Fully implement all AGENTS.md requirements into a usable system (backend + minimal UI), with robust, foolproof behavior.
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
- In progress (foundation complete; full feature implementation underway).

Done:
- Added RBAC, audit, API helpers (rbac.ts, audit.ts, api.ts).
- Extended schema with EventType/LocationType/MarkerStyle and marker fields for Event/Pin/Path.
- Added marker-style CRUD endpoints and minimal UI in Maps page to manage shapes/colors.
- Updated styles and workspace helper; ran prisma generate after schema changes.

Now:
- Build CRUD/workflows for Articles/Overlays/Revisions, Maps/Pins/Paths, Timelines/Events/Eras/Chapters, Reviews, Notifications, ReadState, Assets, PDF, LLM logging.

Next:
- Implement server-side RBAC enforcement and audit logging across all mutations.
- Add minimal UI pages/forms for CRUD and workflows.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- prisma/schema.prisma
- src/lib/api.ts, src/lib/rbac.ts, src/lib/audit.ts, src/lib/workspaces.ts
- src/app/(app)/maps/page.tsx
- src/app/api/marker-styles/*
- src/app/globals.css
- npx prisma generate
