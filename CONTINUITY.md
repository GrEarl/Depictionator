Goal (incl. success criteria):
- Fix UTF-8 encoding for articles list page to unblock Docker build.
- Redeploy on VPS and verify build.
- Maintain CONTINUITY.md updates each turn until overall work is complete.

Constraints/Assumptions:
- Use ssh-mcp via Codex MCP; avoid destructive operations without confirmation.
- Avoid extra user questions; keep responses concise (except brief safety note if needed).

Key decisions:
- Re-encode articles page as UTF-8.

State:
- In progress (encoding fix and redeploying).

Done:
- Added entity map type annotations.

Now:
- Commit UTF-8 fix and push.

Next:
- Pull on VPS and rebuild Docker image.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- src/app/(app)/articles/page.tsx
- git commit, git push
- ssh-mcp rebuild
