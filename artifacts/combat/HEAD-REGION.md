# HEAD-REGION FINDINGS — combat lane answer to the finishers lane (2026-09-18)

From: combat / moves lane (`combat/head-region-v1`)
To: finishers & gore lane, lead, owner
Re: `artifacts/finishers/REQUESTS.md` — "can any shipped move land `head` organically?" and the
Split Crown row (`heavy_overhead @ head`, GAME_SPEC "Owner-authorized finishers & gore — 2026-09-17")

## Verdict up front

**Partly refuted: organic head kills exist in the shipped sim — the cleaver lands them with its
heavies at every realistic range (12/12 distances in the static grid; 37 head blows and 6 head
kills in a 12-seed duel battery).** What the finishers battery actually measured is that the
**hero's longsword can never land head** (and neither can the estoc, trident or knife): their
baked blade arcs pass chest-high through the entire active window at every range, and the
visible animations agree. In the live game the player only wields the longsword (no weapon
selection on trunk), so **Split Crown cannot fire for the player today** — but the blocker is
the hero rigs' *animation arcs*, not the hit-region geometry. The head region is not the fix,
and widening it cannot help (proof below).

## Evidence (reproduce: `node scripts/head-battery.mjs`; pins: `tests/head-region.test.ts`)

Instrument 1 — static grid, every weapon × every combat path × distance 0.85–1.90 m, judged by
the duel's exact registering rule (active window only, first sweep sample inside the 0.31·k
capsule decides the region). Raw table: `artifacts/combat/head-region-evidence.json`.

| weapon | lights | heavy_overhead | thrust / riposte |
|---|---|---|---|
| longsword | torso | torso (legs at max reach) | torso |
| estoc | torso | torso (legs at max reach) | torso |
| trident | legs (the sweep) | torso | torso |
| knife | out of range | out of range | torso/legs |
| **cleaver** | **head 9 / torso 3** | **head 12/12 distances** | torso |

Instrument 2 — seeded AI-vs-AI duels (24 seeds, same `decide`/`stepDuel` entry points as the
tests; the finishers lane's battery mirrors this), side 0's weapon isolated, the Veteran answers:

- longsword: **0 head in ~150 events** — reproduces the finishers lane's 0/285.
- cleaver: `heavy_overhead` 33 head (2 kills), `heavy_counter` 43 head (8 kills),
  `heavy_riposte` 9 head (1 kill); thrust/riposte kills stay torso.

## Why the region is not the lever (geometry)

- A registering blow needs the swept blade within `0.31·k` of the centre capsule. The head is a
  zero-height point at `1.45·k`; torso is `[0.85, 1.30]·k`. A blade passing at height `h` in
  `(1.30, 1.45)` classifies head iff `h > 1.375`.
- The longsword/estoc `Heavy` clip's active samples (sim ages 32–36 of 68, `moves.ts`
  `heavy_overhead: windup 32, active 5`) carry the blade at **y ≈ 0.77–1.24** — below the torso
  band top — at *every* distance. Classification is height-dominated and distance-independent
  here, so no head band that starts above the thrust (max y 1.36 — Run Through must stay torso)
  can ever catch these samples; a band low enough to catch 1.24 would eat the entire torso.
- The cleaver rig's `Heavy` carries the blade at **y ≈ 1.38–1.70 through the active window** —
  skull height, ~7–14 cm from the spine. That is why its heavies read head honestly. The blade
  paths are baked from the visible clips (`scripts/bake-blades.mjs`); the sim data and the
  animation tell the same story for every weapon. Hand-tuning the baked paths (or the timings)
  to force a head classification would desync the hit from the visible blade — against the
  asset-agreement contract and the "readable brutality" rule. The combat lane therefore makes
  **no sim change**.

## OWNER DECISION (2026-09-18) — recorded, this question is closed

The owner re-decided the row: **the v1 finisher set is universal, not locational.**
Split Crown and the four further universal finishers fire on kills from any weapon and any
character — no per-weapon tables, no coarse-location gating — rotating per kill for variety;
weapon/class-specific specials are a later, separate layer. Heavy-blade kill → Split Crown
from the moment the finishers lane applies the one-row change; kick kills, draws and the
player's own death keep their current treatment. The rotation pick must stay a pure function
of the kill event (determinism is a hard spec rule). The findings above remain the evidence
base; the location event stream stays honest sim data for the future weapon-specific layer.

## Regression pins shipped in this branch

`tests/head-region.test.ts` (no `src/` change in this branch at all):

- Only cleaver paths may report head; thrusts/ripostes never (Run Through cannot be silently
  eaten by a future region or re-bake).
- `cleaver` heavy paths must keep ≥1 head-classified distance each (the organic Split Crown
  path stays alive).
- Seeded duel batteries: longsword 0 head; cleaver ≥4 head blows — a drift in either direction
  fails the suite and forces a deliberate look.

## Files

- `scripts/head-battery.mjs` — evidence generator (static grid + 24-seed duel batteries).
- `artifacts/combat/head-region-evidence.json` — raw tallies (regenerate with the script).
- `tests/head-region.test.ts` — the pins above.
