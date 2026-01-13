Goal (incl. success criteria):
- Build the WorldLore Atlas system per AGENTS.md in this repo (full MVP scaffolding across modules).
- Use git for versioning of changes in this workspace.
- Maintain CONTINUITY.md updates each turn until the overall work is complete.

Constraints/Assumptions:
- Follow AGENTS/ledger instructions; keep non-ASCII only where required by source content.
- No destructive operations; avoid removing unrelated changes.
- Approval policy is never; proceed without asking for escalation.

Key decisions:
- Use git commits to record changes going forward.
- Manual Next.js scaffold instead of create-next-app (directory name had uppercase, causing npm name restriction).
- Implement full Prisma schema to relate all entities per AGENTS.md, then build minimal UI/API shell for each area.

State:
- In progress (foundation complete, but not yet fully usable for all AGENTS.md requirements).

Done:
- Expanded Prisma schema to full AGENTS.md model set with relations/enums and uniqueness where needed.
- Added credential auth routes (login/register/logout) with session cookies.
- Added workspace create/join endpoints and dashboard shell.
- Added global filter context + UI and app layout shell with placeholder pages (Articles/Maps/Timeline/Reviews/Settings).
- Added README with docker/env/backup instructions; updated .env.example, docker-compose.yml, .gitignore, and UI styles.
- Fixed BOM issues in package.json and prisma/schema.prisma; ran `npx prisma generate` and `npm run lint` successfully.
- Committed changes (commit eaf25d6) and ledger update (commit 0aec2a1).

Now:
- Clarify to user that full AGENTS.md functionality is not yet implemented; only scaffolding and schema exist.

Next:
- Implement CRUD flows for articles, overlays, revisions, maps, pins, paths, and timelines.
- Add RBAC enforcement and review workflow logic beyond placeholders.
- Add notifications, read states, audit logs, PDF export, LLM panel, and asset handling.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- prisma/schema.prisma
- src/lib/auth.ts, src/lib/password.ts, src/lib/slug.ts
- src/app/(app)/* pages, src/app/login, src/app/register, src/app/api/*
- src/components/*
- README.md, .env.example, docker-compose.yml, .gitignore, src/app/globals.css
- git commits: 05a491f, eaf25d6, 0aec2a1
