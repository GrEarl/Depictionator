Goal (incl. success criteria):
- Fix Next.js PageProps typing for revisions page to unblock Docker build.
- Redeploy on VPS and verify build.
- Maintain CONTINUITY.md updates each turn until overall work is complete.

Constraints/Assumptions:
- Use ssh-mcp via Codex MCP; avoid destructive operations without confirmation.
- Avoid extra user questions; keep responses concise (except brief safety note if needed).

Key decisions:
- Use Promise-based params in page components.

State:
- In progress (patching revisions page and redeploying).

Done:
- Fixed PageProps typing for maps/timeline.

Now:
- Commit revisions typing fix and push.

Next:
- Pull on VPS and rebuild Docker image.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- src/app/(app)/revisions/[id]/page.tsx
- git commit, git push
- ssh-mcp rebuild
