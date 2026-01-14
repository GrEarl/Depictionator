Goal (incl. success criteria):
- Fix Next.js PageProps typing for maps/timeline pages to unblock Docker build.
- Redeploy on VPS and verify build.
- Maintain CONTINUITY.md updates each turn until overall work is complete.

Constraints/Assumptions:
- Use ssh-mcp via Codex MCP; avoid destructive operations without confirmation.
- Avoid extra user questions; keep responses concise (except brief safety note if needed).

Key decisions:
- Accept Promise-based searchParams to satisfy Next.js types.

State:
- In progress (patching maps/timeline and redeploying).

Done:
- Fixed PageProps typing in article detail page earlier.

Now:
- Commit maps/timeline typing fix and push.

Next:
- Pull on VPS and rebuild Docker image.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- src/app/(app)/maps/page.tsx
- src/app/(app)/timeline/page.tsx
- git commit, git push
- ssh-mcp rebuild
