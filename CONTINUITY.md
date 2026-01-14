Goal (incl. success criteria):
- Fix readState type annotation for lastReadRevisionId in articles page.
- Redeploy on VPS and verify build.
- Maintain CONTINUITY.md updates each turn until overall work is complete.

Constraints/Assumptions:
- Use ssh-mcp via Codex MCP; avoid destructive operations without confirmation.
- Avoid extra user questions; keep responses concise.

Key decisions:
- Expand readState type annotation to include lastReadRevisionId.

State:
- In progress (patching and redeploying).

Done:
- Restored ENTITY_TYPES header and entity annotations.

Now:
- Commit readState type fix and push.

Next:
- Pull on VPS and rebuild Docker image.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- src/app/(app)/articles/page.tsx
- git commit, git push
- ssh-mcp rebuild
