# COMBAT-001 reopened (Dom, 2026-10-06): late notice fixes most of the ladder cliff; the Goblin needs an offence change

Strategy prototype, sim only. **Dom overruled "leave the cliff"**: fix it. The experiment hooks are in `combat-001-late-notice-experiment.patch` beside this brief (`git apply` it to run the sweeps; globalThis knobs, default off; the k-curve variant dropped since detmath bans `**`), not shippable; Combat turns the winner into a real rule.

## Tools (on this branch)
- `scripts/ladder-sweep.mjs`: #1373's sweep (closed, never merged), now importable (`import.meta.main` guard).
- `scripts/cliff-check.mjs`: L1–46, six wardens × blocker/skilled; prints worst adjacent drop and the L6/18/46 anchors. `EXP_<KNOB>=v` env sets `globalThis.__<KNOB>`. Run one process per opponent (`--opponents=veteran`): ~4 min for all six at n=120 on 6 cores.
- **Use n=120.** At n=40 one cell is ±8 pts, so a 25-pt bar is a coin flip on borderline rows.

## 1. The cliff: what was tested (n=120 unless marked)
Worst adjacent-level drop. Bar ≤ 25. Anchors: L6 / L18 win% vs trunk.

| row | trunk | head-start parry (n=40) | **late notice W=6 (best)** | W=8 | W=6, k=1.5 |
|---|---|---|---|---|---|
| veteran blocker | 64 | 57 | **23** | 19 | 17 |
| veteran skilled | 84 | 88 | **30** | 28 | (not run) |
| executioner blocker | 66 | 55 | **25** | 24 | 27 |
| executioner skilled | 62 | 57 | **20** | 22 | 23 |
| dwarf blocker | 42 | 47 | **15** | 14 | 12 |
| dwarf skilled | 40 | 50 | **12** | 14 | 18 |
| knight blocker | 62 | 62 | **40** | 38 | 36 |
| knight skilled | 49 | 48 | **24** | 24 | 24 |
| pitborn blocker | 49 | 53 | **25** | 21 | 21 |
| pitborn skilled | 51 | 47 | **23** | 22 | 24 |
| shieldmaiden blocker | 56 | 65 | **26** | 24 | 30 |
| shieldmaiden skilled | 70 | 70 | **24** | 27 | 24 |
| L18 anchor shift (worst) | 0 | ~0 | **±7** (vet 20→27, dwarf 52→47) | vet 20→43 ✗ | ±4 |

- **Cause, confirmed by plan logs:** at L11 (reaction 20 = the cut's windup) the warden's block/parry plan is formed on the contact tick and never lands; at L12 (19) ~65 % of cuts are answered, and mostly by BLOCKS, not parries. Hence "head-start parry" (parry → block when spare < 4) changed nothing. Falsified.
- **Late notice (the winner):** at plan time, with `spare = windup − reaction`, if `0 < spare < W` the answer is in time only `spare / W` of the time (else `ignore`). W=6 = the spare a 20-tick cut has at the Normal reaction 14, so the ramp completes at Normal. `spare > 0` guard: no RNG drawn below the crossing, so **L1–11 are byte-identical to trunk** (L6 anchors equal).
- **Still failing:** veteran skilled 30 and knight blocker 40, both at the FIRST step L11→12 (the first answered cuts hurt most). Shieldmaiden blocker 26 and executioner blocker 25 are within noise. Curving the ramp (k=1.5) did not fix the first step.
- **Next for Combat:**
  1. Make W=6 linear a real rule: an `AiProfile` or `READ` constant, no globalThis.
  2. Try one more first-step softener, e.g. a 1-level-later ramp start for the Knight's 160 hp body, or W measured from the opponent's own Normal reaction.
  3. Run test:all and re-pin with reasons (fix-forward); the Veteran battery must stay 29/30 Easy.
  4. RECORD_VERSION bump if a fight changes (#1402 fingerprint).

## 2. Goblin and Witch
- **The sweep's "blocker" is superhuman:** it guards the correct side on tick 0 of every swing. Re-run with a human-like defender (guard/parry only once the swing is 12 ticks old, wrong side 20 %; harness logic in this brief's PR description):

| human-like bot, win % | L6 | L18 | L46 |
|---|---|---|---|
| Witch blocker / skilled | 65 / 73 | 35 / 43 | 22 / 43 |
| Nightborn (control) | 40 / 63 | 7 / 12 | 2 / 3 |
| **Goblin** | **97 / 92** | **83 / 85** | **82 / 90** |

- **Witch: no change needed** (she scales against a human). Goblin: genuinely flat.
- **Why the Goblin is flat** (damage log, L46 vs blocker): he evades ~78 % of cuts already, but starts only ~9 attacks a fight, most of them blocked, and lands ~4 damage a hit vs the player's 16. His offence does not scale.
- **Knob grid** (normal/hard, human bots):
  - kick 1, feint .6/.8, discipline 8/2, pressure .9/1: **no effect**.
  - Dodge is the only lever (hard .95 → L46 5 %), BUT:
    - above ~.7 at hard the Goblin battery fails "light spam untouched 3–8/24": he becomes unhittable, which feels bad;
    - at normal ≥ .65 the AI-vs-AI median goes 46.7 s, over the 45 s ceiling;
    - his "patient answer must beat light spam" rows sit at 0–3 wins, so they flip on ±1.
- **Ask for Combat (design, not a number):** give his OFFENCE something that scales by level and beats a held guard. Candidates: a knife flurry that drains guard stamina; feints that switch side late (a human misreads); a guard-opening kick that actually fires against a reactive guard (today `kickNow` needs a guard held ≥ reaction ticks, which a reactive blocker never shows). Re-judge with the human-like bot, not the tick-0 blocker.
- **Gate:** add a ladder sweep (human-like bots, L6/18/46, all ten opponents) to the battery so no rung can go flat silently.
