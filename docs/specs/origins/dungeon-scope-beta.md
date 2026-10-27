# Beta dungeon: scope page (Strategy, 2026-10-17 09:2x)

Dom's beta scope (10-16): two zones, Zone 1 + ONE dungeon, plus the Pit; ladder levels 1-2; 20 spells. This page is the dungeon's scope. Look and feel come from Dom through the Test Zone Sandbox; Lead lifts this into docs/ as a docs PR.

## What it is
- A **shared zone with a roof**: one more zone row on the same runtime as Zone 1 (zones-as-data, `new-zone.mjs --like`), rows only, hooks.ts within the 300-line budget. No new engine, no instancing.
- **Population**: the copy rules from the endgame brief (rule 8/9): soft cap row 20, hard cap 30, floor 8, fill-fullest routing. Contested, not starved.
- **Entrance**: a cave mouth in Zone 1 near the ash-pits / Cinder Fields camp (where the kobold legend already stands), a landmark row with an exit to the dungeon zone and a return exit at the mouth. Seamless engage rules unchanged; warm-up at zone entry (0 compiles after zone ready) applies.
- **Level band**: Zone 1's band top and one above (L4-6). A sheeted Recruit at L5 should clear it with care; a L2 bare hero should turn back after the first room.
- **Creatures** (existing rows only, no new archetypes for beta): kobolds (legend-kobold-ash-pits family) as the population, goblins as patrols, one Giant Salamander as the end fight, placed with the camp spacing rule (aggro edges apart, no two-creature cliffs at the band bottom). Many-on-one rules (retarget, crowd cut, evade on no-contact) apply as they land.
- **Boss**: the salamander is a normal enemy of its level with the troll treatment (hp x2, +20% damage) via rows; the ladder legend for the dungeon's rank slot is a ladder row, not new content.
- **Loot**: server-verified kill loot via the normal path; one fixed ground placement at the end room (a starter-tier piece, outside the salamander's aggro so it can be taken by backing out). Guest rules apply (loot for the session, "Sign in to keep it" nudge, never persisted).
- **Light**: the dungeon is dark by data: a sky/ambient row and the lantern props; no new lighting code.

## Theme (default, pending Dom's line)
The bone-and-skull cave camp with lanterns from Dom's second reference picture. Reason: Characters' goblin fort kit (skull totem, bone lantern, stakes, banner) is already commissioned, so the dungeon kit's first half exists; the remaining pieces are a cave wall segment, a bone pile and a rough-hewn doorway. No per-zone modelling: the dungeon uses the building-skins row system the Test Zone Sandbox is building.

## Who does what
- Dom + Test Zone Sandbox: theme line, look, dome/rows, first proof on his phone.
- Characters & Art: the kit pieces on the sandbox's commission (after kit-warm CI follow-up), $0 paths first.
- World: the zone row, entrance landmark, placements, caps; stills at 375.
- Combat: band tuning receipts (row hash + body + level + starter kit worn).
- Backend: nothing new unless the entrance needs a server exit row.

## Acceptance (beta)
1. Enter from Zone 1 and return, seamless, 0 compiles after zone ready, on Dom's iPhone.
2. Two phones see each other inside; cap rows honoured (copies open at 20).
3. L5 sheeted Recruit clears the end fight 35-55% over 40 seeds; L2 bare hero loses the first room.
4. Guest run: same fights, loot for the session, nothing persisted.
5. The whole dungeon is rows + hooks.ts under budget; Zone 1 golden unchanged.
