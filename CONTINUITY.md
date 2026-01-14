Goal (incl. success criteria):
- Fix implicit any in articles list readState map.
- Redeploy on VPS and verify build.
- Maintain CONTINUITY.md updates each turn until overall work is complete.

Constraints/Assumptions:
- Use ssh-mcp via Codex MCP; avoid destructive operations without confirmation.
- Avoid extra user questions; keep responses concise (except brief safety note if needed).

Key decisions:
- Add explicit type for readState map callback.

State:
- In progress (patching articles page and redeploying).

Done:
- Fixed multiple PageProps/route typing issues and encoding problems.

Now:
- Commit articles page type fix and push.

Next:
- Pull on VPS and rebuild Docker image.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- src/app/(app)/articles/page.tsx
- git commit, git push
- ssh-mcp rebuild
