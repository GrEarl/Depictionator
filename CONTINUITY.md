Goal (incl. success criteria):
- Fix articles page header corruption and entity type annotations after regex replace.
- Redeploy on VPS and verify build.
- Maintain CONTINUITY.md updates each turn until overall work is complete.

Constraints/Assumptions:
- Use ssh-mcp via Codex MCP; avoid destructive operations without confirmation.
- Avoid extra user questions; keep responses concise.

Key decisions:
- Restore ENTITY_TYPES array and EntitySummary type block.

State:
- In progress (commit fix and redeploy).

Done:
- Repaired header section in articles page and re-encoded as UTF-8.

Now:
- Commit and push fix, then pull on VPS and rebuild.

Next:
- docker-compose up -d and health check once build succeeds.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- src/app/(app)/articles/page.tsx
- git commit, git push
- ssh-mcp rebuild
