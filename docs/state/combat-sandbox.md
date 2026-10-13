# Combat Sandbox (Dom's lane) — state

READ FIRST: brief = Strategy's "Frankendom lane: Combat Sandbox" paste (2026-10-13). Questions go to Project Strategy, not Dom.

## LIVE
- https://frankendom.com/preview/sandbox/ — published 2026-10-13 from branch `sandbox/page` on trunk 501f5f0c3 (release-DU).
- Worktree: ~/Developer/frankendom-sandbox (node_modules is a symlink to the Desktop checkout's; never commit it).

## How it works
- `sandbox/entry.ts` patches the row JSON objects in memory, then imports `src/main.ts`. src/fight is never edited.
- Override layers: committed `sandbox/rows.json`, then the browser's unsaved edits (localStorage `frankendom.sandbox.rows`).
- Panel: opponent picker (`?opponent=`, the 17 roster ids), one textarea per row family, one row per line. Apply = reload; Reset to live; Save = downloads rows.json (Dom sends it, the lane commits it).
- Families in the panel today: sheet-defs, stance-defs, gear-defs, damage-kind-defs, cc-defs, swarm-defs, bosses.
- Publish: `sandbox/publish.sh` (rsync to VPS /root/frankendom-worktrees/sandbox, build there, copy into current/preview/sandbox). A release swaps `current`, so republish after each release.

## Next
- Hero build editor (level + points on the ten dials) — the sheet panel edits the dial ROWS, not Dom's hero's placed points yet.
- Immunity tiers and level curve rows: locate their files.
- Rebase onto trunk after each release, then republish.
