Goal (incl. success criteria):
- Fix readStateMap type to expose lastReadRevisionId in articles page.
- Redeploy on VPS and verify build.
- Maintain CONTINUITY.md updates each turn until overall work is complete.

Constraints/Assumptions:
- Use ssh-mcp via Codex MCP; avoid destructive operations without confirmation.
- Avoid extra user questions; keep responses concise.

Key decisions:
- Add explicit Map generic for readStateMap.

State:
- In progress (patching and redeploying).

Done:
- Added readState callback type.

Now:
- Commit readStateMap type fix and push.

Next:
- Pull on VPS and rebuild Docker image.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- src/app/(app)/articles/page.tsx
- git commit, git push
- ssh-mcp rebuild
