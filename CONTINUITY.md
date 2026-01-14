Goal (incl. success criteria):
- Fix Next.js route handler params typing for asset file route.
- Redeploy on VPS and verify build.
- Maintain CONTINUITY.md updates each turn until overall work is complete.

Constraints/Assumptions:
- Use ssh-mcp via Codex MCP; avoid destructive operations without confirmation.
- Avoid extra user questions; keep responses concise (except brief safety note if needed).

Key decisions:
- Use Promise-based params in Next.js route handlers.

State:
- In progress (patching asset route and redeploying).

Done:
- Fixed PageProps typing for maps/timeline/revisions/workspace/article pages.

Now:
- Commit asset route typing fix and push.

Next:
- Pull on VPS and rebuild Docker image.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- src/app/api/assets/file/[id]/route.ts
- git commit, git push
- ssh-mcp rebuild
