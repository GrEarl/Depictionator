Goal (incl. success criteria):
- Fix overlay list type annotations to include truthFlag.
- Redeploy on VPS and verify build.
- Maintain CONTINUITY.md updates each turn until overall work is complete.

Constraints/Assumptions:
- Use ssh-mcp via Codex MCP; avoid destructive operations without confirmation.
- Avoid extra user questions; keep responses concise (except brief safety note if needed).

Key decisions:
- Expand overlay type annotation to include truthFlag.

State:
- In progress (patching and redeploying).

Done:
- Added overlay and revision annotations earlier.

Now:
- Commit overlay truthFlag type fix and push.

Next:
- Pull on VPS and rebuild Docker image.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- src/app/(app)/articles/[id]/page.tsx
- git commit, git push
- ssh-mcp rebuild
