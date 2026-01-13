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
- In progress (CRUD coverage expanded with diff/restore and soft-delete; several update routes and minimal edit forms still pending).

Done:
- Added archive/restore UI across entities/maps/timelines/chapters/eras/overlays/viewpoints/marker styles.
- Added revision diff page + restore-as-new-draft endpoint.
- Added entity metadata update endpoint + form.
- Strengthened server-side validation: workspace scoping and map/timeline existence checks.
- Added involved entities for events; added timeline/map filter application from global filters.
- Added review assignment endpoint + UI.
- Added diff dependency and updated global filter options from DB.
- Ran prisma generate and lint successfully.
- Added update endpoints for paths/timelines/eras/chapters/events.
- Added minimal update forms for maps/pins/paths/timelines/eras/chapters/events.
- Ran npm run lint (passed; deprecation warning for next lint).
- Added review comment endpoint + UI and comment notifications.
- Added asset listing with archive/restore in settings.
- Added watcher notifications on update routes for maps/pins/paths/timelines/events.
- Ran npm run lint (passed).

Now:
- Confirm audit logging and workspace scoping on new update routes.
- Scan for remaining AGENTS.md gaps (watch toggles on non-article items, map/timeline visualization).

Next:
- Add/confirm update forms on maps/timeline pages.
- Extend notifications/watch triggers for updates beyond review approvals.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- prisma/schema.prisma
- src/app/(app)/articles/[id]/page.tsx, src/app/(app)/articles/page.tsx
- src/app/(app)/maps/page.tsx, src/app/(app)/timeline/page.tsx, src/app/(app)/settings/page.tsx
- src/app/(app)/revisions/[id]/page.tsx
- src/app/api/* (archive/restore, revisions/restore, reviews/assign, articles/update)
- src/components/GlobalFilters.tsx, src/app/(app)/layout.tsx
- npx prisma generate, npm run lint
