Goal (incl. success criteria):
- Redeploy on VPS and verify Docker build/health check.
- Maintain CONTINUITY.md updates each turn until overall work is complete.

Constraints/Assumptions:
- Use ssh-mcp via Codex MCP; avoid destructive operations without confirmation.
- Avoid extra user questions; keep responses concise.

Key decisions:
- Added explicit Map generic for readStateMap.

State:
- In progress (fixing build error).

Done:
- Committed and pushed readStateMap type fix.
- Fixed archivedEntities typo and pushed.
- Typed global filter option maps in app layout.
 - Typed map read state map source in maps page.

Now:
- Commit maps page type fix and push.

Next:
- Pull on VPS, rebuild Docker image, then /health check.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- src/app/(app)/articles/page.tsx
- git commit, git push
- ssh-mcp rebuild
