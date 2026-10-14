# ROLL and GUARD in the world — spec (World, draft for Lead's OK; no code until then)

Source: the "ROLL/GUARD in the world = Expansion follow-up" line in `docs/state/strategy.md` (Now), and Dom 2026-10-07 15:5x (ledger): the Zone 1 world uses the Pit controls exactly, ROLL and GUARD included.

## What is already on trunk (read at bac87dac8, not run)
- `origins/preview/pit-duel.ts` `worldStep`: a private Practice (same sim, stamina, roll distance, guard rules) stepped at 60 Hz beside the walk. It returns the ground a roll or backstep covers and the phase (roll / backstep / guard).
- `origins/preview/main.ts` ~L277-281: the dodge/backstep buttons call `wc.roll(dir)` (stick direction, or facing for a plain dodge), `wc.guard(i.guard, i.guardDirection)` runs every frame, and `worldPhase` plays the rig's roll / guard clip.
- Attack buttons start a duel against the nearest creature (`pressEngage`); roll and guard outside a duel are therefore free-roam moves with stamina.

## What I could not confirm from the code (the gap this spec must close)
1. Whether a creature in aggro range that attacks the hero in the open world is resolved by the same sim, so that a roll dodges it and a guard blocks it, or whether those only matter once a duel is engaged.
2. Whether the Pit's directional guard (guard side) is shown in the world HUD.
3. Whether roll/guard stamina shows in the world HUD.

## Proposal (smallest change that makes the buttons count)
- If (1) is "duel only": a creature that reaches melee range joins the hero into a duel (the existing engage path), so roll and guard resolve in the one combat engine ("one combat engine everywhere", Strategy ruling). No new damage rules in the open world.
- If (1) is already true: this item shrinks to HUD and feel checks for (2) and (3), and the answer is a short docs note.
- Presentation only (clips, HUD) changes no sim file; no WSV. Anything that touches `src/core/world-sim.ts` or world rules takes WSV 38 at merge-up, with the digest re-pinned in `tests/world-sim-guard.test.ts`.

## Checks (when approved)
Browser row at 375 wide in `/preview/origins/?region=1`: roll moves the hero the Pit's distance and plays the roll clip; guard holds and shows its side; a creature hit while rolling or guarding is resolved as in the Pit. Before/after stills in the PR (visual-pr-stills).

## Questions for Lead
- Which of (1)-(3) does Dom actually see broken on his phone test? That decides which branch of the proposal runs.
- Donor check: the Pit itself (src/fight) is the donor; I propose no other.
