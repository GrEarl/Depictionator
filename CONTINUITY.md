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
- Typed marker style arrays in maps page.
- Typed map/pin/path/archived map arrays in maps page.
- Guarded null locationType when reading style map.
- Defaulted null path arrowStyle for MapEditor payload.
- Typed dashboard membership list.
- Re-encoded dashboard page to UTF-8.
- Typed dashboard notification list.
- Typed reviews page lists and re-encoded to UTF-8.
- Typed settings page viewpoints/assets and re-encoded to UTF-8.

Now:
- Commit settings page typing/encoding fix and push.

Next:
- Pull on VPS, rebuild Docker image, then /health check.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- src/app/(app)/articles/page.tsx
- git commit, git push
- ssh-mcp rebuild
