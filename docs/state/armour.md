# Armour — project state

Lane opened 2026-09-26 15:2x +04 by Strategy on Dom's order ("open a new armour lane, as we have a weapons lane"). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md). Folder `~/Developer/frankendom-armour`, session name **Frankendom - Armour**, key `armour`.

## Now — armour lane, as of 2026-09-26 15:2x +04 (replace this section wholesale; it is the restart brief, not history)

**Who you are.** You own every non-weapon piece a fighter can wear, across every opponent and the hero: helmets, crests, body, arms, gloves, greaves, boots, shields. Weapons stay with the Weapons lane (blades, hafts, the draw and the carry). Web owns the loot panel and the Profile tab. You own what a piece looks like, how it fits, and how it grades by rank.

**Why the lane exists.** Gear work was scattered: Veteran fixing the Centurion crest, Character Main tinting by rank, World fixing the Plague Doctor's hat, the Dwarf's greaves floating off the hero's calves and his boots z-fighting with nobody assigned. Nobody owned how a piece looks once it moves onto the hero, and that move is the whole loot loop.

**Standards, no exceptions.**
- Every piece is built for the body it sits on. A piece that is offered to the hero is fitted to the hero's mesh, not stretched from the opponent's. The crest lesson: a 49 cm crest over a 30 cm helm floats 11 cm in the air (Veteran's measurement, 2026-09-26).
- Real materials: colour, roughness/metal, normal. No flat unlit slabs. Cloth is cloth, iron is iron, horsehair is horsehair. Dom on the crest: "looks like a digital paint image sitting in the air above the realistic helmet."
- Rank grading (Brief 19 + ruling C): a piece is graded by the rung it was TAKEN at, map-preserving tint on metal, trim and leather only; cloth and the body never tint. Ten rungs Recruit → Origin. Character Main's Centurion sheet at build e6a23dd4 is the reference; Dom has not yet ruled on helmet-only ladder vs greaves/arms, or wraps as cloth.
- Every visual change ships with 375-wide A/B stills from the fight camera and the Profile tab BEFORE any PR (Strategy rule 2026-09-23: visual PRs need stills before merge). Dom judges from stills.
- Phone first: budget the maps (≤512 px per piece unless Lead says otherwise), check the phone tier.

**First jobs, in order. Take them over; the previous owner hands you the branch.**
1. **Centurion crest** (from Veteran, branch in flight, head ~17:30 today): seated on his crown, strand fan, HorsehairCloth material. Finish it, stills to Lead. Then the same crest on the HERO's helmet (his floats by the same amount).
2. **Rank-tint retune** (from Character Main, `char/rank-tint`, e6a23dd4): after Dom rules on the sheet, do the retune round. Wraps → cloth, untinted, is Lead's recommendation.
3. **Plague Doctor's hat**: it is NOT_WORN on the opponent today (src/loot.ts) because its cloth roughness threw a silver sheen. Re-texture so he wears it again. Remove him from NOT_WORN when it reads right.
4. **Dwarf greaves and boots** (NOT_WORN today): refit to the hero's shin, fix the z-fight on his own scan.
5. **Audit pass**: every takeable piece on the hero, all four launch characters plus opponents, one contact sheet per slot. List every float, clip, z-fight and flat material. That list is your backlog; Lead orders it.

**Rulings in force (Dom, 2026-09-26).** After a kill every piece of the opponent's kit is takeable, even if owned; taking an owned piece is a swap; a Recruit-taken helmet and a Praetorian-taken helmet are different pieces. Lanes follow their names: you do armour, not weapons, not UI.

**How you work.** Read `AGENTS.md` and `PROJECT_STATE.md` first. Report to Lead (Frankendom - Lead Developer), milestones only. PRs off trunk `codex/01a09a76/task-1`; the deploy session merges and ships, you never do. Memory lives at `~/.claude/projects/-Users-domininclynch-Developer-frankendom-armour/memory/`. When a task closes and you are past ~200k context, rewrite this Now section, save memory, `/clear`.

## Done today
- 2026-09-26: lane opened (folder, identity file, this doc). Nothing built yet.

## Open
- Dom's rulings on the rank sheet (helmet-only ladder? wraps as cloth?).
- Handover of the crest branch from Veteran and `char/rank-tint` from Character Main, via Lead.

## Gotchas
- `node_modules` is a symlink to the strategy worktree's; run `npm ci` here if a check needs a clean tree.
- loot.glb is rebuilt from per-piece sources; do not hand-edit the built file.
