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

## Verdict
All three hold. This item closes with **no build**; the Strategy "Now" line ("ROLL/GUARD in the world = Expansion follow-up") is stale. No sim file changes, so no WSV.

## Caveat and the one check I'd still run if Lead wants it
Everything above is from reading code; I did not run it. A short headless browser pass on the VPS (375 wide, `/preview/origins/?region=1`, walk into a creature's aggro, press ROLL, hold GUARD, read the stamina meter and the Guard button's `data-side`) would turn "by construction" into a receipt. Say the word and I run it and add the stills here.
