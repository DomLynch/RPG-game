# Combat Sandbox (Dom's lane) — state

READ FIRST: brief = Strategy's "Frankendom lane: Combat Sandbox" paste (2026-10-13). Questions go to Project Strategy, not Dom.

## RULING (Strategy 2026-10-13, replaces brief rule 1)
- The sandbox MAY edit src/fight on sandbox/* branches (same files, no copy).
- A mechanic = one new template in src/fight + rows in sandbox/rows.json; rows absent = inert. No sandbox-only flags/build switches.
- One commit per mechanic, "sandbox-mech: <name>", with its own red-to-green test. Rows off = fingerprint identical to trunk.
- Rebase after every release. Max 5 mech commits; a mech 2 releases old without Dom's verdict is dropped or promoted.
- REUSE FIRST: hit stop rows (#2515), poise/flinch ladder (#2525), hit-impact.ts, stagger rows. Ask Combat what exists before each mech.
- Page footer (panel bottom) shows trunk base, engine fingerprint, active mechs. One line to Lead per preview publish.

## REUSE-FIRST RECEIPTS (Combat & Specials, cross-session reply 2026-10-13, read on trunk 411671c23)
- wounds: trunk's src/fight/wounds.ts (tests/wounds.test.ts) is creature BLOOD from the catalogue, presentation only, never read by the sim; hamstrung.ts is a finisher pose. The sim's attrition wound is duel.ts `wound` (legWound, RULES.attrition). Combat: "an arm wound that lowers guard/block: NOT THERE ... the extension point is the same hit site (duel.ts:476-479)". sandbox-mech wounds extends exactly that site and the stance quantities (stanced), not wounds.ts.
- impact: trunk's hit-impact.ts tiers (tests/hit-impact.test.ts) are the hit-stop frames + camera knock; Combat: "MISSING: a screen flash, a ground shockwave ring ... add the flash/ring/clang as columns of hit-stop-defs.json after #2515, do not fork a second tier table". sandbox-mech impact reads hit-impact.ts impactTier and adds optional columns to #2515's hit-stop-defs.json rows (cherry-picked under it).
- crowd: Combat: "No roar-on-big-hit or on-kill trigger found"; sandbox-mech crowd extends src/audio/arena.ts's own play() and cues.

## LIVE
- https://frankendom.com/preview/sandbox/ — published 2026-10-13 from branch `sandbox/page` on trunk 501f5f0c3 (release-DU).
- Worktree: ~/Developer/frankendom-sandbox (node_modules is a symlink to the Desktop checkout's; never commit it).

## How it works
- `sandbox/entry.ts` patches the row JSON objects in memory, then imports `src/main.ts`. src/fight is never edited.
- Override layers: committed `sandbox/rows.json`, then the browser's unsaved edits (localStorage `frankendom.sandbox.rows`).
- Panel: opponent picker (`?opponent=`, the 17 roster ids), one textarea per row family, one row per line. Apply = reload; Reset to live; Save = downloads rows.json (Dom sends it, the lane commits it).
- Families in the panel today: sheet-defs, stance-defs (+wounds), hit-stop-defs (contacts, keyed), crowd-defs, gear-defs, damage-kind-defs, cc-defs, swarm-defs, bosses.
- Mechs on the branch: wounds, impact, crowd (on #2515 cherry-picked). Unit tests 22/22 green on VPS 2026-10-13.
- Publish: `sandbox/publish.sh` (rsync to VPS /root/frankendom-worktrees/sandbox, build there, copy into current/preview/sandbox). A release swaps `current`, so republish after each release.

## Next
- Hero build editor (level + points on the ten dials) — the sheet panel edits the dial ROWS, not Dom's hero's placed points yet.
- Immunity tiers and level curve rows: locate their files.
- Rebase onto trunk after each release, then republish.
