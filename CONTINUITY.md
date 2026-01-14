Goal (incl. success criteria):
- Fix UTF-8 encoding errors in settings/login pages to unblock Docker build.
- Push fix and redeploy on VPS.
- Maintain CONTINUITY.md updates each turn until overall work is complete.

Constraints/Assumptions:
- Use ssh-mcp via Codex MCP; avoid destructive operations without confirmation.
- Avoid extra user questions; keep responses concise (except brief safety note if needed).

Key decisions:
- Re-encode problematic files as UTF-8.

State:
- In progress (fixing encoding, pushing, rebuilding on VPS).

Done:
- Identified build failure due to invalid UTF-8 in settings/login pages.

Now:
- Commit encoding fix and push.

Next:
- Pull on VPS and rebuild docker image.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- src/app/(app)/settings/page.tsx
- src/app/login/page.tsx
- git commit, git push
- ssh-mcp: git pull, docker-compose build/up
