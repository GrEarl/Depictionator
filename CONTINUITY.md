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
- In progress (core CRUD largely in place; remaining gaps are markdown rendering, mermaid display, and actual map visualization).

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
- Added entityId support on pin create/update forms/routes.
- Added related entity/event fields for path create.
- Added watch toggles on maps/timelines/events list UI.
- Ran npm run lint (passed).
- Added unread indicators for articles and maps with read-state support.
- Added map mark-read actions and badge styling.
- Ran npm run lint (passed).
- Added LLM context plumbing (page context tags + API handling).
- Ran npm run lint (passed).
- Added Markdown renderer with Mermaid support and styling.
- Added Leaflet-based map viewer with marker shapes/colors.
- Added asset file serving endpoint and map image/bounds support.
- Ran npm run lint (passed).

Now:
- Scan for remaining AGENTS.md gaps (map editor UI, Mermaid in overlays done, notifications completeness).

Next:
- Extend notifications/watch triggers beyond review approvals where needed.

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
