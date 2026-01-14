Goal (incl. success criteria):
- Fix TypeScript types in article detail by introducing shared revision/overlay types.
- Redeploy on VPS and verify build.
- Maintain CONTINUITY.md updates each turn until overall work is complete.

Constraints/Assumptions:
- Use ssh-mcp via Codex MCP; avoid destructive operations without confirmation.
- Avoid extra user questions; keep responses concise (except brief safety note if needed).

Key decisions:
- Introduce RevisionSummary/Overlay types to remove implicit any and missing fields.

State:
- In progress (patching and redeploying).

Done:
- Prior PageProps and route param fixes pushed.

Now:
- Commit article detail type fixes and push.

Next:
- Pull on VPS and rebuild Docker image.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- src/app/(app)/articles/[id]/page.tsx
- git commit, git push
- ssh-mcp rebuild
