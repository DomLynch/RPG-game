# ROLL and GUARD in the world — spec (World; closes with no build)

Source: the "ROLL/GUARD in the world = Expansion follow-up" line in `docs/state/strategy.md` (Now), and Dom 2026-10-07 15:5x (ledger): the Zone 1 world uses the Pit controls exactly, ROLL and GUARD included.

## What is already on trunk (read at bac87dac8, not run)
- `origins/preview/pit-duel.ts` `worldStep`: a private Practice (same sim, stamina, roll distance, guard rules) stepped at 60 Hz beside the walk. It returns the ground a roll or backstep covers and the phase (roll / backstep / guard).
- `origins/preview/main.ts` ~L277-281: the dodge/backstep buttons call `wc.roll(dir)` (stick direction, or facing for a plain dodge), `wc.guard(i.guard, i.guardDirection)` runs every frame, and `worldPhase` plays the rig's roll / guard clip.
- Attack buttons start a duel against the nearest creature (`pressEngage`); roll and guard outside a duel are therefore free-roam moves with stamina.

## The three unknowns, answered from trunk bac87dac8 (read, not run)
1. **Creature hits honour roll/guard: YES.** The open world is not a separate model. `src/fight/world-combat.ts` (createWorldCombat, tick ~L104-111) steps the Pit's own `stepHero(world, quantStep(hero, guardHeld, pendingAttack, pendingRoll, guardSide))` every 60 Hz tick with the hunting creatures in the same `world`; a hit arrives as the engine's `Hit` event (L85) and calls `onHeroHit` (flash + Hit clip). `main.ts` L277-281 feeds `wc.roll(dir)` and `wc.guard(held, side)` from the Pit's controls. A roll or guard therefore changes what the sim does to the hero, because it is the same sim.
2. **Guard side in the HUD: YES, by the control itself.** The world uses `src/fight/input.ts` (the Pit's kit, switched on with the duel chunk, `origins/preview/index.html` L127): the Guard button's `data-side` follows the thumb slide or Q+arrow (input.ts L346-360, L447-450) and `src/style.css` L1366-1381 draws the tick for the side. Same element, same CSS.
3. **Stamina in the HUD: YES.** `meters.feed(wc)` runs every frame in `main.ts` (after the walk step) and paints `wc.hero().stamina` into the `fm-st` meter (`src/fight/hud.ts` createMeters.feed). It hides while the hero is at full health and stamina with no foe and no fight, so it appears the moment a roll spends stamina.

## Browser receipt (VPS, 2026-10-14 ~21:00, trunk bac87dac8, one niced core, no HF spend)
Built preview (`vite build`), headless Chromium at 375x812 (SwiftShader: the VPS has no GPU), `/preview/origins/?region=1`, goblin "Cinder scavenger" engaged, driven through the REAL on-screen buttons (`#dodge-button` tap, `#guard-button` mouse-down + slide). Page errors: none. Receipt: `world-roll-guard/receipt.json`.

| Still | Shows | Evidence |
|---|---|---|
| [still1-roll.png](world-roll-guard/still1-roll.png) | ROLL pressed on the button: hero in the roll clip with creatures adjacent | `combat().hero.phase === 'roll'` |
| [still2-guard.png](world-roll-guard/still2-guard.png) | GUARD held, thumb slid left | `hero.phase === 'guard'`, Guard button `data-side="left"` (the button lights; I read the side from the attribute, not from the pixels) |
| [still3-stamina.png](world-roll-guard/still3-stamina.png) | stamina meter (yellow bar under health) after a roll | `.fm-st` 65 / 100, meters visible; hero stamina 65 / 100 (the value in receipt.json, from the same run as the three stills) |

**Not shown: a roll that dodges a creature hit.** Two runs tried it and neither gives a clean result, so I am not claiming it: (run 2, wall-clock sampling) a ROLL pressed in a creature's windup was followed by 127 -> 95 hp, but I sampled at 0.7 s and cannot say whether the hit landed before the roll, during it or after; a second press, in the creature's recover phase, rolled with hp unchanged (nothing to dodge). (run 3, 25 ms timeline) the hero stayed in `roll` for about 380 samples: on the loaded VPS under SwiftShader the page runs at a few fps and `world-combat.ts` caps steps per frame (`MAX_STEPS`), so game time runs far slower than wall time and wall-clock timing is meaningless here. A roll's dodge is a sim rule, so it wants a deterministic test in game ticks, not a browser run.

### Reading the meters plate (answer to Lead's review)
The plate (top-left, `.fm-meters`, `src/fight/hud.ts` createMeters, order `name, foe, hp, stamina`) is ONE block: the line of text is the FOE's name, and the three bars under it are, top to bottom, the foe's health (red), YOUR health (green) and YOUR stamina (thin yellow, 5 px). [still3-stamina-crop.png](world-roll-guard/still3-stamina-crop.png) draws each bar's box on still3: the yellow bar measures 97 of 150 px = 65%, which is `receipt.json`'s 65/100. So the player's stamina is the thin yellow bar, but nothing on the plate says which bars are theirs: the only label is the creature's name. That is a legibility weakness, not a missing meter.
Target plate (still2): `wc.target()` (`src/fight/world-combat.ts` L148) names the primary pair's foe (the creature he is engaged with), and only if none, the nearest hunting creature. It is not stale; it follows the engaged foe. A different creature standing in front but not engaged (not `hunting`) is never the plate's target. I could not reproduce a "Kobold · Lv 10" in my stills (they show only the Cinder scavengers), so I cannot say what that label was.

## Verdict
(a) Creature hits go through the same sim as the Pit's roll/guard: read from code, the browser run shows the controls drive that sim (roll and guard phases) but does not show a dodge. (b) Guard side: shown, `data-side` follows the slide. (c) Stamina meter: shown after a roll.

The dodge itself is covered deterministically in game ticks by PR #2752 (`tests/world-roll-dodge.test.ts`, test only, no WSV): no roll = a Hit on the hero; rolling toward the foe 8-16 ticks ahead of the blow = a `Dodged` and no Hit; pressed on the blow tick = too late, the Hit lands; rolling away = the blow finds nothing in reach. Measured band on trunk bac87dac8: 4-20 ticks ahead dodges, 0-3 too late. 2/2 pass on the VPS, typecheck:tests clean.
