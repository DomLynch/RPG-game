# Sandbox v2 (foe folder): state, 2026-10-17 (read first; detail in docs/state/combat-sandbox.md)

## Now
- Folder `~/Developer/frankendom-sandbox-foe`, branch `sandbox/foe-spells` fast-forwarded to `sandbox/page`; preview https://frankendom.com/preview/sandbox/ (publish with `sandbox/publish.sh`; tests and builds on the VPS: `scp` changed files to `/root/frankendom-worktrees/sandbox`, then `node --test`, `tsc --noEmit -p .`, `eslint`, `npm run -s check:as-data -- --gate`; the Mac has no node_modules). Sandbox-only: nothing to trunk or live, Combat promotes.
- Five spells in the picker (`spellPick` rows in sandbox/rows.json; trunk `[]` = every spell): ugallu (start, dust shock), brokkr (Pit first win, Ash Fall), kamaitachi (Zone 1, Wind Wall), banshee (Zone 2, Nyx Nightfall), gula (universal heal, SPELL 2). Each has its own look `vfx` (src/fight/spell-vfx.ts, AAA-style pass 1: noise-eroded shader surfaces, smoke puffs, glints, one light) which replaces the designed special effect.
- Rules in rows: every spell casts from point blank to one reach `spellReach` 2500 cm; no melee spells (all roots outer + magic); `spellSkillFloor` 100 (otherwise spells fizzle: outcome = skill vs 2 x cost); `spellHeal` gula 25% max health, mana, 2 s windup, 2 uses.

## Done today
Spell picker 20 -> 30 -> 5; player-cast effects fix (29 of 50 drew nothing); fizzle fix; reach row; heal spell; Dummy button; donor study (docs/specs/combat/spell-effects-donors.md); visuals proposal (docs/specs/combat/spell-visuals-proposal.md, Strategy aligned); heal v2 and then all five looks in spell-vfx.ts (tests/sandbox-spell-vfx.test.ts). Everything committed, pushed, published; git clean.

## Open
1. Dom has NOT yet seen the five new looks on his phone: ask, then iterate (Ash Fall / Wind Wall / Nyx / dust shock were written but only the heal was inspected in a real browser).
2. Strategy's gates not yet met: before/after stills and a 2-second clip per spell; frame cost <= 1.5 ms on the test phone; 0 new shader programs after zone ready (warm() compiles them at scene creation: unmeasured on a phone).
3. Cut from pass 1 (Strategy): heat distortion, persistent decals, Blender flipbooks not needed yet (procedural noise used); add only if Dom asks. Windup anticipation glow and a sound per spell are not built.
4. The unlock flow (win a fight, take the slain legend's spell; Pit, Zone 1, Zone 2) is progression code for Career / Combat; not built. `requires: {stat, min}` (intelligence gating) is a design note only.
5. The sandbox is behind trunk (trunk now past 7f78800a9); a merge of trunk is owed before any promotion.

## Gotchas
- Re-read `globalThis.__sandboxMatch.practice.duel` every sample in page JS (the duel object is replaced each tick); a pane screenshot between tool calls is frozen, so capture frames with `canvas.toDataURL` in page JS and overlay them as an <img>, then screenshot.
- `?spell=<id>` plus `&cast=100`; the Dummy link is `?spar=1&weapon=longsword&difficulty=dummy&skill=none&opponent=Centurion`. Click Fight with the ref from `find`.
- No Bash file edits (hook): use Edit / Write. A one-line TS function with a trailing `//` comment swallows the rest of the line (broke special-presentation.ts once).
- Plague Flies draws nothing on a player cast; headless "pieces drawn" is not a strength measure.
- Strategy session id `local_285aa097-e5ed-433c-ba22-3e4a0f25ea29` ("Project Strategy - Fable 5.1"); no AskUserQuestion pop-ups: pick a default and write it down.
