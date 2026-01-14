Goal (incl. success criteria):
- Fix TypeScript implicit any in article detail overlay map.
- Redeploy on VPS and verify build.
- Maintain CONTINUITY.md updates each turn until overall work is complete.

Constraints/Assumptions:
- Use ssh-mcp via Codex MCP; avoid destructive operations without confirmation.
- Avoid extra user questions; keep responses concise (except brief safety note if needed).

Key decisions:
- Add explicit overlay type annotation to satisfy TS.

State:
- In progress (patching article page and redeploying).

Done:
- Fixed route and page param typings.

Now:
- Commit overlay typing fix and push.

Next:
- Pull on VPS and rebuild Docker image.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- src/app/(app)/articles/[id]/page.tsx
- git commit, git push
- ssh-mcp rebuild
