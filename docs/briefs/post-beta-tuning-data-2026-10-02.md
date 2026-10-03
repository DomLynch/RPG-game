# Post-beta per-opponent tuning proposal (Stats lane, analysis only, no src change)

Harness: live revision e70ab1 sim (frozen), `tune/curve.ts` and `tune/lib.ts` re-implement profileAt/opponentAt without the id cache so a tuned variant is just a `Tune` object (per-anchor AiProfile overrides, `health`, `poise`, `guard`, `regen`). All runs on the VPS under /tmp/stats-tune, nice 19, P=3. Every number below is a measured win rate; nothing is predicted.

Target (the pooled curve): mean of the ten baseline opponents per level, i.e. mid about 50 % at L1 falling to 33 % by L8 and flat after (rank 3 = L11-15 onward), mastery 93 % at L1 falling to about 73 % by L20 and flat. "In band" = the per-rank mean (5 levels x 40 seeds = 200 fights, SE about 3 points) is within +-10 points of the pooled target. Bots: mid = perfect-parry script that answers each swing with p = 0.3, mastery = the perfect-parry script; a mid bot is "a player who answers swings with parries".

## Result in one table

Every change is an existing lever (anchor knobs at L6/L18/L46, `health`, `guard`). Knob tables per opponent are further down; this is the summary.

| opponent | body / guard change | mid ranks in band | mastery ranks in band | guard rows over 80 % at L6+ (before -> after) | tap attack L1 /24 (before -> after) |
|---|---|---|---|---|---|
| veteran | health 150->180 | 10/10 | 7/10 | 5 -> 1 | 24 -> 24 |
| nightborn | health 150->188, guard.recovery 40->28 | 10/10 | 1/10 | 1 -> 0 | 24 -> 24 |
| plaguedoctor | health 150->195, guard.window 16->12, guard.recovery 40->20, guard.commits true->false | 9/10 | 1/10 | 0 -> 1 | 24 -> 24 |
| witch | health 150->173 | 10/10 | 0/10 | 0 -> 0 | 24 -> 24 |
| goblin | health 120->156 | 10/10 | 0/10 | 4 -> 4 | 22 -> 22 |
| pitborn | health 190->114 | 9/10 | 1/10 | 7 -> 12 | 24 -> 24 |
| executioner | health 160->96 | 9/10 | 3/10 | 0 -> 4 | 21 -> 24 |
| dwarf | health 170->128 | 9/10 | 8/10 | 2 -> 5 | 24 -> 24 |
| knight | health 160->80 | 7/10 | 0/10 | 5 -> 12 | 24 -> 24 |
| shieldmaiden | health 190->175 | 10/10 | 3/10 | 6 -> 8 | 24 -> 24 |
## What worked, what did not (read this before the tables)

1. Against the mid and mastery bots (both parry scripts), the dominant lever is HEALTH. A parry-riposte kill is a few big hits, so win rate moves in steps: health 128 and 119 and 112 gave identical dwarf curves, 96 and 112 gave identical knight curves. Health cannot be fine-tuned; the fit is as good as the steps allow.
2. INERT against both bots (measured, r1/r2/r7): the AI's reaction, accuracy, parry, dodge, lapse, read, discipline and the body's poise. Shifting parry, dodge, reaction by +-6 ticks / +-.24 did not move any bot curve; poise 12 vs 18 was byte-identical. They still matter to a HUMAN, so the Plague Doctor and Nightborn identity changes below use them, but they are not what fits the curve and I cannot vouch for their feel from bot data.
3. Levers that DO move the bots besides health: aggression, pressure and feint (feint mainly lowers mastery), and for the Nightborn the guard recovery. Aggression moves mastery on the heavy-weapon bodies (executioner, knight, dwarf, pitborn) and almost not at all on the fast-blade bodies (veteran, witch, nightborn, plague doctor).
4. NOT FIT: mastery. The ten opponents sit 10-27 points above the 73-79 % mastery target (witch, nightborn, plague doctor, goblin, knight, pitborn are the worst). Mid and mastery cannot both be hit with one health value: the perfect-parry script beats the fast-blade bodies 90-100 % even when the mid bot is held to 33 %. The proposal fits MID (the stated objective). The goblin is the extreme: it never parries or guards, so at the health that fits mid (156) mastery is 25-37 % (target 73); at baseline health mid is 60-67 %. No single health value fits both; mid chosen.
5. RAMP: only partly delivered. Mastery now falls with level for the veteran (97 at rank 1, 75-86 from rank 2 on), the executioner (100 at rank 1 down to 78 at L46) and weakly for the witch (99 -> 88); the knight's mastery does not ramp (95-100 throughout); for the nightborn and plague doctor mastery stays 90-98 flat with a small drop at L1-5 (80-85). A strong ramp attempt (aggression .15->.3, feint .2->.6, pressure) on veteran, witch, nightborn and plague doctor (round 6) did not move their mastery curves past what feint alone did, so the proposal ships the milder feint ramp (feint 0 at L6, 0.1-0.2 at L18, 0.3-0.5 at L46 on veteran / witch / nightborn; the plague doctor ramps through aggression, pressure, feint and disengage). Honest summary: "ramp" is visible on mid-skill terms only as the (intended) flat 33 %; mastery ramp for the fast-blade bodies is not reachable with existing levers.
6. L1-5 (rank 1): the novice blend already scales opponent body and skill, so the per-opponent mid at L1-3 is set by the novice blend, not by these levers. Pitborn, executioner and dwarf come out 10-20 points above target at L1-3 (health cut x novice 0.7) and the plague doctor 15-30 above; accepted, not fit (flagged "(out)" in the rank tables).
7. NO-STRATEGY GUARD (rows over 80 % of 24 seeds, 8 scripted no-skill strategies incl. tap attack): "anywhere" cannot be literal, because L1-5 is the novice ladder where the tap attack must win (every opponent: light spam, held lights, heavy only and charged heavy only are already 21-24/24 there, before and after). At L6+ the guard is already broken in the live sim for several bodies (veteran 5 rows, pitborn 7, shieldmaiden 6, knight 5, goblin 4 via kick only). The proposal CLEARS it for the veteran (5 -> 1: tap attack L8 21/24 remains) and nightborn (1 -> 0), keeps witch at 0, goblin unchanged (4 kick-only rows), and WORSENS it where I cut health to lift mid: pitborn 7 -> 12 rows, knight 5 -> 12, dwarf 2 -> 5, executioner 0 -> 4, shieldmaiden 6 -> 8 (plague doctor 0 -> 1: thrust from range L8 20/24). These five are in direct tension: the mid bot loses to them because they are aggressive and heavy, so the only lever that lifts mid wins is a thinner body, and a thinner body is what lets light spam / tap attack win. The five need either the guard exempted for them at L6-12 or a lever the bots do not expose (I found none among the existing ones). Decision for Lead: the numbers say you cannot have mid 33 % and the guard on these bodies with health alone. Full row lists are in the Gates tables.
8. TAP-ATTACK L1 GATE: 24/24 for all opponents except the goblin (22/24, same as baseline) after the change; the executioner improves from 21/24 to 24/24. L2-3 degrade for the goblin (17/24, 14/24 vs 23, 20 before): a consequence of its 30 % health raise; it stays an L1-only gate.
9. Knight: the final choice (health 80, aggression +.15 capped at 1.0, pressure -.15 floored at 0, i.e. 0 / 0 / 0.35) is the best of ten variants tried, 7/10 ranks in band for mid; health 96-112 gave 6/10 and the lower health is what pushed the guard to 12 rows. Treat the knight as UNRESOLVED: its current row is the Executioner's placeholder.
10. Noise: the baseline is 30 seeds, the proposal 40 seeds, same seed numbers 1..30 inside. A single checkpoint level has SE of 7-8 points; use the per-rank means, not single levels. Gate rows are 24 seeds, so "over 80 %" means 20 or more of 24.
11. Not tested: weapon changes, the equipped skills (the sim is frozen and these runs have no skill and no boss special), specials, other player weapons, other seeds beyond 40. A human is not a parry script; mid-bot numbers say "a player who answers swings with parries", not "a median player".

## Nightborn vs Plague Doctor (today the plague doctor row is a copy of the nightborn row)

Baseline proof: the two rows give byte-identical curves and byte-identical behaviour counts (table in the Gates section: same lights, heavies, thrusts, parries per fight at L6/L18/L46). Both carry the estoc.

Proposed split, using only existing knobs:
- Nightborn = the parry-commit duelist, as the code comment describes him: keeps guard window 16 and `commits: true`, parry raised +0.1 (0.35 / 0.8 / 0.9 at L6 / L18 / L46), feint 0 -> 0.2 -> 0.4 (so he baits with feints at higher levels), guard recovery 40 -> 28 ticks (a whiffed parry exposes him for less), health 188. Measured: he now parries 2.5 times a fight at L18 and 3.5 at L46 (0.1 and 0.3 before) and throws about 5.5-6.1 thrusts per fight.
- Plague Doctor = the evasive pressure fighter: no commit (`commits: false`), window 12, recovery 20, parry 0.15 / 0.5 / 0.6, dodge 0.3 / 0.5 / 0.6, feint 0.1 / 0.25 / 0.55, disengage 0.3 / 0.4 / 0.5, circle 0.4 / 0.5 / 0.6, step 0.5 / 0.6 / 0.7 (the goblin identity knobs, hit-and-hop), aggression 0.55 / 0.65 / 0.75 and pressure 0.6 / 0.65 / 0.7 (lights over heavies), reaction slowed 16/6/5 -> 18/10/8 (the 6-tick reaction was the nightborn's), health 195. Measured: more lights (14-17.6 vs 11.5-13 per fight), 3.1-4.3 backsteps per fight where the nightborn takes none, 7.1 parries at L46, fights 15-25 % longer (2437-2804 ticks vs 2101-2357).
- Caveat: the bots cannot see most of this difference. Their win curves are nearly identical by design (both fitted to the same mid target), and parry / dodge / reaction are inert against a parry script. The distinction is in behaviour counts and in what a human will face; it needs a human playtest or the Combat battery before anyone trusts the feel. The plague doctor's mid L1-3 stays 15-30 points above target.

## How to read the per-opponent tables

`current -> proposed` lists only the knobs that change (value at the anchor level; the ladder blends linearly between L6, L18 and L46 and the novice blend runs L1-5). `feint` "absent" means the knob is not set today (0). Targets are the pooled curve. `before` is the live revision (30 seeds), `after` is the proposal (40 seeds). The same numbers are in proposal.json (`opponents.<id>.knobs`, `.tune` = the exact Tune object fed to the harness, `.checkpoints`, `.ranks`, `.ranksInBand`; `gates`; `probe`).


# Per-opponent tables

### veteran

Knob changes (value at the anchor level; levels between anchors blend linearly, L1-5 is the novice blend off the L6 anchor):

| anchor | knob | current | proposed |
|---|---|---|---|
| easy (L6) | feint | absent | 0 |
| normal (L18) | feint | absent | 0.2 |
| hard (L46) | feint | absent | 0.5 |
| body | health | 150 | 180 |

Win % by level (checkpoints). before = baseline 30 seeds, after = proposal 40 seeds; target = pooled curve.

| bot | L1 | L2 | L3 | L5 | L8 | L10 | L15 | L20 | L30 | L46 |
|---|---|---|---|---|---|---|---|---|---|---|
| mid target | 50 | 44 | 39 | 35 | 33 | 33 | 33 | 33 | 33 | 33 |
| mid before | 50 | 63 | 53 | 37 | 43 | 53 | 37 | 47 | 43 | 50 |
| mid after | 43 | 50 | 53 | 23 | 28 | 25 | 20 | 28 | 28 | 25 |
| mastery target | 93 | 88 | 84 | 82 | 79 | 77 | 75 | 73 | 73 | 73 |
| mastery before | 100 | 100 | 97 | 100 | 93 | 97 | 100 | 97 | 93 | 90 |
| mastery after | 100 | 100 | 95 | 98 | 75 | 78 | 90 | 80 | 88 | 83 |

Per-rank mean win % (all levels of the rank, 5 levels x 40 seeds = 200 fights, SE about 3 points):

| rank | levels | mid target | mid before | mid after | mastery target | mastery before | mastery after |
|---|---|---|---|---|---|---|---|
| 1 | 1-5 | 41 | 49 | 39 | 86 | 98 | 97 (out) |
| 2 | 6-10 | 33 | 43 | 25 | 79 | 95 | 81 |
| 3 | 11-15 | 33 | 45 | 24 | 76 | 95 | 86 |
| 4 | 16-20 | 33 | 39 | 25 | 74 | 95 | 85 (out) |
| 5 | 21-25 | 33 | 45 | 29 | 73 | 96 | 82 |
| 6 | 26-30 | 33 | 41 | 30 | 73 | 95 | 81 |
| 7 | 31-35 | 33 | 49 | 30 | 73 | 93 | 77 |
| 8 | 36-40 | 33 | 50 | 36 | 73 | 95 | 84 (out) |
| 9 | 41-45 | 33 | 57 | 30 | 73 | 90 | 75 |
| 10 | 46-46 | 33 | 50 | 25 | 73 | 90 | 83 |

Ranks within +-10 of target after: mid 10/10, mastery 7/10.

### nightborn

Knob changes (value at the anchor level; levels between anchors blend linearly, L1-5 is the novice blend off the L6 anchor):

| anchor | knob | current | proposed |
|---|---|---|---|
| easy (L6) | parry | 0.25 | 0.35 |
| easy (L6) | feint | absent | 0 |
| normal (L18) | parry | 0.7 | 0.8 |
| normal (L18) | feint | absent | 0.2 |
| hard (L46) | parry | 0.8 | 0.9 |
| hard (L46) | feint | absent | 0.4 |
| body | health | 150 | 188 |
| guard | guard.recovery | 40 | 28 |

Win % by level (checkpoints). before = baseline 30 seeds, after = proposal 40 seeds; target = pooled curve.

| bot | L1 | L2 | L3 | L5 | L8 | L10 | L15 | L20 | L30 | L46 |
|---|---|---|---|---|---|---|---|---|---|---|
| mid target | 50 | 44 | 39 | 35 | 33 | 33 | 33 | 33 | 33 | 33 |
| mid before | 83 | 73 | 60 | 60 | 63 | 67 | 70 | 73 | 67 | 57 |
| mid after | 68 | 63 | 28 | 45 | 33 | 30 | 33 | 25 | 30 | 30 |
| mastery target | 93 | 88 | 84 | 82 | 79 | 77 | 75 | 73 | 73 | 73 |
| mastery before | 87 | 97 | 93 | 93 | 100 | 100 | 100 | 100 | 97 | 100 |
| mastery after | 80 | 93 | 90 | 93 | 95 | 95 | 100 | 98 | 95 | 98 |

Per-rank mean win % (all levels of the rank, 5 levels x 40 seeds = 200 fights, SE about 3 points):

| rank | levels | mid target | mid before | mid after | mastery target | mastery before | mastery after |
|---|---|---|---|---|---|---|---|
| 1 | 1-5 | 41 | 69 | 50 | 86 | 94 | 90 |
| 2 | 6-10 | 33 | 63 | 33 | 79 | 100 | 96 (out) |
| 3 | 11-15 | 33 | 60 | 32 | 76 | 98 | 96 (out) |
| 4 | 16-20 | 33 | 71 | 29 | 74 | 99 | 97 (out) |
| 5 | 21-25 | 33 | 70 | 26 | 73 | 99 | 94 (out) |
| 6 | 26-30 | 33 | 68 | 26 | 73 | 97 | 94 (out) |
| 7 | 31-35 | 33 | 60 | 31 | 73 | 99 | 95 (out) |
| 8 | 36-40 | 33 | 68 | 30 | 73 | 100 | 95 (out) |
| 9 | 41-45 | 33 | 67 | 27 | 73 | 100 | 94 (out) |
| 10 | 46-46 | 33 | 57 | 30 | 73 | 100 | 98 (out) |

Ranks within +-10 of target after: mid 10/10, mastery 1/10.

### plaguedoctor

Knob changes (value at the anchor level; levels between anchors blend linearly, L1-5 is the novice blend off the L6 anchor):

| anchor | knob | current | proposed |
|---|---|---|---|
| easy (L6) | reaction | 16 | 18 |
| easy (L6) | parry | 0.25 | 0.15 |
| easy (L6) | dodge | 0.1 | 0.3 |
| easy (L6) | aggression | 0.5 | 0.55 |
| easy (L6) | pressure | 0.4 | 0.6 |
| easy (L6) | feint | absent | 0.1 |
| easy (L6) | disengage | absent | 0.3 |
| easy (L6) | circle | absent | 0.4 |
| easy (L6) | step | absent | 0.5 |
| normal (L18) | reaction | 6 | 10 |
| normal (L18) | parry | 0.7 | 0.5 |
| normal (L18) | dodge | 0.1 | 0.5 |
| normal (L18) | aggression | 0.55 | 0.65 |
| normal (L18) | pressure | 0.45 | 0.65 |
| normal (L18) | feint | absent | 0.25 |
| normal (L18) | disengage | absent | 0.4 |
| normal (L18) | circle | absent | 0.5 |
| normal (L18) | step | absent | 0.6 |
| hard (L46) | reaction | 5 | 8 |
| hard (L46) | parry | 0.8 | 0.6 |
| hard (L46) | dodge | 0.15 | 0.6 |
| hard (L46) | aggression | 0.65 | 0.75 |
| hard (L46) | pressure | 0.6 | 0.7 |
| hard (L46) | feint | absent | 0.55 |
| hard (L46) | disengage | absent | 0.5 |
| hard (L46) | circle | absent | 0.6 |
| hard (L46) | step | absent | 0.7 |
| body | health | 150 | 195 |
| guard | guard.window | 16 | 12 |
| guard | guard.recovery | 40 | 20 |
| guard | guard.commits | true | false |

Win % by level (checkpoints). before = baseline 30 seeds, after = proposal 40 seeds; target = pooled curve.

| bot | L1 | L2 | L3 | L5 | L8 | L10 | L15 | L20 | L30 | L46 |
|---|---|---|---|---|---|---|---|---|---|---|
| mid target | 50 | 44 | 39 | 35 | 33 | 33 | 33 | 33 | 33 | 33 |
| mid before | 83 | 73 | 60 | 60 | 63 | 67 | 70 | 73 | 67 | 57 |
| mid after | 80 | 65 | 50 | 43 | 35 | 35 | 33 | 40 | 33 | 23 |
| mastery target | 93 | 88 | 84 | 82 | 79 | 77 | 75 | 73 | 73 | 73 |
| mastery before | 87 | 97 | 93 | 93 | 100 | 100 | 100 | 100 | 97 | 100 |
| mastery after | 85 | 88 | 85 | 93 | 100 | 98 | 93 | 93 | 98 | 90 |

Per-rank mean win % (all levels of the rank, 5 levels x 40 seeds = 200 fights, SE about 3 points):

| rank | levels | mid target | mid before | mid after | mastery target | mastery before | mastery after |
|---|---|---|---|---|---|---|---|
| 1 | 1-5 | 41 | 69 | 56 (out) | 86 | 94 | 90 |
| 2 | 6-10 | 33 | 63 | 34 | 79 | 100 | 96 (out) |
| 3 | 11-15 | 33 | 60 | 33 | 76 | 99 | 95 (out) |
| 4 | 16-20 | 33 | 71 | 41 | 74 | 99 | 96 (out) |
| 5 | 21-25 | 33 | 70 | 34 | 73 | 99 | 94 (out) |
| 6 | 26-30 | 33 | 68 | 38 | 73 | 97 | 94 (out) |
| 7 | 31-35 | 33 | 60 | 38 | 73 | 99 | 93 (out) |
| 8 | 36-40 | 33 | 68 | 39 | 73 | 100 | 95 (out) |
| 9 | 41-45 | 33 | 67 | 33 | 73 | 100 | 93 (out) |
| 10 | 46-46 | 33 | 57 | 23 | 73 | 100 | 90 (out) |

Ranks within +-10 of target after: mid 9/10, mastery 1/10.

### witch

Knob changes (value at the anchor level; levels between anchors blend linearly, L1-5 is the novice blend off the L6 anchor):

| anchor | knob | current | proposed |
|---|---|---|---|
| easy (L6) | feint | absent | 0 |
| normal (L18) | feint | absent | 0.1 |
| hard (L46) | feint | absent | 0.3 |
| body | health | 150 | 173 |

Win % by level (checkpoints). before = baseline 30 seeds, after = proposal 40 seeds; target = pooled curve.

| bot | L1 | L2 | L3 | L5 | L8 | L10 | L15 | L20 | L30 | L46 |
|---|---|---|---|---|---|---|---|---|---|---|
| mid target | 50 | 44 | 39 | 35 | 33 | 33 | 33 | 33 | 33 | 33 |
| mid before | 60 | 60 | 43 | 63 | 57 | 47 | 57 | 47 | 50 | 53 |
| mid after | 45 | 53 | 50 | 43 | 35 | 33 | 33 | 30 | 30 | 33 |
| mastery target | 93 | 88 | 84 | 82 | 79 | 77 | 75 | 73 | 73 | 73 |
| mastery before | 100 | 100 | 100 | 100 | 97 | 93 | 100 | 100 | 93 | 100 |
| mastery after | 100 | 100 | 100 | 98 | 98 | 100 | 95 | 93 | 95 | 88 |

Per-rank mean win % (all levels of the rank, 5 levels x 40 seeds = 200 fights, SE about 3 points):

| rank | levels | mid target | mid before | mid after | mastery target | mastery before | mastery after |
|---|---|---|---|---|---|---|---|
| 1 | 1-5 | 41 | 55 | 43 | 86 | 99 | 99 (out) |
| 2 | 6-10 | 33 | 51 | 36 | 79 | 97 | 97 (out) |
| 3 | 11-15 | 33 | 53 | 37 | 76 | 99 | 98 (out) |
| 4 | 16-20 | 33 | 54 | 36 | 74 | 99 | 95 (out) |
| 5 | 21-25 | 33 | 50 | 34 | 73 | 99 | 94 (out) |
| 6 | 26-30 | 33 | 55 | 35 | 73 | 99 | 96 (out) |
| 7 | 31-35 | 33 | 51 | 31 | 73 | 99 | 95 (out) |
| 8 | 36-40 | 33 | 52 | 38 | 73 | 98 | 89 (out) |
| 9 | 41-45 | 33 | 51 | 33 | 73 | 99 | 91 (out) |
| 10 | 46-46 | 33 | 53 | 33 | 73 | 100 | 88 (out) |

Ranks within +-10 of target after: mid 10/10, mastery 0/10.

### goblin

Knob changes (value at the anchor level; levels between anchors blend linearly, L1-5 is the novice blend off the L6 anchor):

| anchor | knob | current | proposed |
|---|---|---|---|
| easy (L6) | aggression | 0.7 | 0.6 |
| normal (L18) | aggression | 0.85 | 0.75 |
| hard (L46) | aggression | 0.95 | 0.85 |
| body | health | 120 | 156 |

Win % by level (checkpoints). before = baseline 30 seeds, after = proposal 40 seeds; target = pooled curve.

| bot | L1 | L2 | L3 | L5 | L8 | L10 | L15 | L20 | L30 | L46 |
|---|---|---|---|---|---|---|---|---|---|---|
| mid target | 50 | 44 | 39 | 35 | 33 | 33 | 33 | 33 | 33 | 33 |
| mid before | 60 | 57 | 50 | 53 | 57 | 60 | 57 | 67 | 67 | 67 |
| mid after | 48 | 53 | 35 | 45 | 30 | 33 | 35 | 48 | 53 | 40 |
| mastery target | 93 | 88 | 84 | 82 | 79 | 77 | 75 | 73 | 73 | 73 |
| mastery before | 100 | 63 | 70 | 80 | 70 | 70 | 53 | 77 | 67 | 53 |
| mastery after | 60 | 63 | 40 | 55 | 18 | 30 | 38 | 28 | 33 | 28 |

Per-rank mean win % (all levels of the rank, 5 levels x 40 seeds = 200 fights, SE about 3 points):

| rank | levels | mid target | mid before | mid after | mastery target | mastery before | mastery after |
|---|---|---|---|---|---|---|---|
| 1 | 1-5 | 41 | 55 | 44 | 86 | 76 | 52 (out) |
| 2 | 6-10 | 33 | 58 | 35 | 79 | 70 | 28 (out) |
| 3 | 11-15 | 33 | 60 | 31 | 76 | 64 | 28 (out) |
| 4 | 16-20 | 33 | 60 | 37 | 74 | 69 | 31 (out) |
| 5 | 21-25 | 33 | 65 | 32 | 73 | 61 | 30 (out) |
| 6 | 26-30 | 33 | 63 | 41 | 73 | 71 | 25 (out) |
| 7 | 31-35 | 33 | 61 | 36 | 73 | 57 | 37 (out) |
| 8 | 36-40 | 33 | 77 | 39 | 73 | 62 | 27 (out) |
| 9 | 41-45 | 33 | 67 | 40 | 73 | 62 | 25 (out) |
| 10 | 46-46 | 33 | 67 | 40 | 73 | 53 | 28 (out) |

Ranks within +-10 of target after: mid 10/10, mastery 0/10.

### pitborn

Knob changes (value at the anchor level; levels between anchors blend linearly, L1-5 is the novice blend off the L6 anchor):

| anchor | knob | current | proposed |
|---|---|---|---|
| easy (L6) | pressure | 0.6 | 0.75 |
| normal (L18) | pressure | 0.7 | 0.85 |
| hard (L46) | pressure | 0.75 | 0.9 |
| body | health | 190 | 114 |

Win % by level (checkpoints). before = baseline 30 seeds, after = proposal 40 seeds; target = pooled curve.

| bot | L1 | L2 | L3 | L5 | L8 | L10 | L15 | L20 | L30 | L46 |
|---|---|---|---|---|---|---|---|---|---|---|
| mid target | 50 | 44 | 39 | 35 | 33 | 33 | 33 | 33 | 33 | 33 |
| mid before | 40 | 23 | 10 | 3 | 7 | 7 | 7 | 7 | 7 | 7 |
| mid after | 60 | 85 | 50 | 43 | 30 | 28 | 25 | 38 | 33 | 38 |
| mastery target | 93 | 88 | 84 | 82 | 79 | 77 | 75 | 73 | 73 | 73 |
| mastery before | 87 | 63 | 47 | 67 | 60 | 53 | 33 | 50 | 27 | 40 |
| mastery after | 100 | 100 | 90 | 98 | 95 | 100 | 90 | 93 | 95 | 93 |

Per-rank mean win % (all levels of the rank, 5 levels x 40 seeds = 200 fights, SE about 3 points):

| rank | levels | mid target | mid before | mid after | mastery target | mastery before | mastery after |
|---|---|---|---|---|---|---|---|
| 1 | 1-5 | 41 | 17 | 55 (out) | 86 | 66 | 95 |
| 2 | 6-10 | 33 | 7 | 34 | 79 | 49 | 97 (out) |
| 3 | 11-15 | 33 | 7 | 39 | 76 | 31 | 96 (out) |
| 4 | 16-20 | 33 | 6 | 40 | 74 | 37 | 95 (out) |
| 5 | 21-25 | 33 | 3 | 35 | 73 | 31 | 95 (out) |
| 6 | 26-30 | 33 | 7 | 40 | 73 | 25 | 95 (out) |
| 7 | 31-35 | 33 | 4 | 40 | 73 | 28 | 94 (out) |
| 8 | 36-40 | 33 | 5 | 37 | 73 | 23 | 96 (out) |
| 9 | 41-45 | 33 | 5 | 38 | 73 | 35 | 95 (out) |
| 10 | 46-46 | 33 | 7 | 38 | 73 | 40 | 93 (out) |

Ranks within +-10 of target after: mid 9/10, mastery 1/10.

### executioner

Knob changes (value at the anchor level; levels between anchors blend linearly, L1-5 is the novice blend off the L6 anchor):

| anchor | knob | current | proposed |
|---|---|---|---|
| easy (L6) | aggression | 0.45 | 0.55 |
| easy (L6) | feint | absent | 0.1 |
| normal (L18) | aggression | 0.65 | 0.75 |
| normal (L18) | feint | absent | 0.1 |
| hard (L46) | aggression | 0.85 | 0.95 |
| hard (L46) | feint | absent | 0.1 |
| body | health | 160 | 96 |

Win % by level (checkpoints). before = baseline 30 seeds, after = proposal 40 seeds; target = pooled curve.

| bot | L1 | L2 | L3 | L5 | L8 | L10 | L15 | L20 | L30 | L46 |
|---|---|---|---|---|---|---|---|---|---|---|
| mid target | 50 | 44 | 39 | 35 | 33 | 33 | 33 | 33 | 33 | 33 |
| mid before | 20 | 17 | 33 | 30 | 7 | 0 | 7 | 3 | 7 | 17 |
| mid after | 53 | 50 | 60 | 38 | 43 | 25 | 20 | 25 | 23 | 33 |
| mastery target | 93 | 88 | 84 | 82 | 79 | 77 | 75 | 73 | 73 | 73 |
| mastery before | 100 | 100 | 97 | 97 | 93 | 83 | 80 | 73 | 73 | 50 |
| mastery after | 100 | 100 | 100 | 100 | 95 | 95 | 88 | 93 | 85 | 78 |

Per-rank mean win % (all levels of the rank, 5 levels x 40 seeds = 200 fights, SE about 3 points):

| rank | levels | mid target | mid before | mid after | mastery target | mastery before | mastery after |
|---|---|---|---|---|---|---|---|
| 1 | 1-5 | 41 | 23 | 53 (out) | 86 | 98 | 100 (out) |
| 2 | 6-10 | 33 | 7 | 32 | 79 | 91 | 96 (out) |
| 3 | 11-15 | 33 | 5 | 29 | 76 | 80 | 90 (out) |
| 4 | 16-20 | 33 | 5 | 25 | 74 | 75 | 89 (out) |
| 5 | 21-25 | 33 | 2 | 30 | 73 | 73 | 83 |
| 6 | 26-30 | 33 | 5 | 28 | 73 | 69 | 85 (out) |
| 7 | 31-35 | 33 | 6 | 33 | 73 | 61 | 81 |
| 8 | 36-40 | 33 | 5 | 27 | 73 | 59 | 84 (out) |
| 9 | 41-45 | 33 | 5 | 35 | 73 | 52 | 85 (out) |
| 10 | 46-46 | 33 | 17 | 33 | 73 | 50 | 78 |

Ranks within +-10 of target after: mid 9/10, mastery 3/10.

### dwarf

Knob changes (value at the anchor level; levels between anchors blend linearly, L1-5 is the novice blend off the L6 anchor):

| anchor | knob | current | proposed |
|---|---|---|---|
| easy (L6) | pressure | 0.4 | 0.6 |
| normal (L18) | pressure | 0.5 | 0.7 |
| hard (L46) | pressure | 0.55 | 0.75 |
| body | health | 170 | 128 |

Win % by level (checkpoints). before = baseline 30 seeds, after = proposal 40 seeds; target = pooled curve.

| bot | L1 | L2 | L3 | L5 | L8 | L10 | L15 | L20 | L30 | L46 |
|---|---|---|---|---|---|---|---|---|---|---|
| mid target | 50 | 44 | 39 | 35 | 33 | 33 | 33 | 33 | 33 | 33 |
| mid before | 37 | 20 | 27 | 3 | 7 | 13 | 3 | 7 | 3 | 3 |
| mid after | 65 | 35 | 45 | 33 | 20 | 25 | 28 | 25 | 35 | 33 |
| mastery target | 93 | 88 | 84 | 82 | 79 | 77 | 75 | 73 | 73 | 73 |
| mastery before | 87 | 67 | 90 | 83 | 77 | 70 | 43 | 37 | 37 | 60 |
| mastery after | 98 | 98 | 98 | 100 | 88 | 78 | 78 | 63 | 68 | 68 |

Per-rank mean win % (all levels of the rank, 5 levels x 40 seeds = 200 fights, SE about 3 points):

| rank | levels | mid target | mid before | mid after | mastery target | mastery before | mastery after |
|---|---|---|---|---|---|---|---|
| 1 | 1-5 | 41 | 22 | 44 | 86 | 83 | 99 (out) |
| 2 | 6-10 | 33 | 7 | 22 (out) | 79 | 72 | 84 |
| 3 | 11-15 | 33 | 3 | 23 | 76 | 49 | 77 |
| 4 | 16-20 | 33 | 7 | 23 | 74 | 39 | 62 (out) |
| 5 | 21-25 | 33 | 3 | 24 | 73 | 41 | 74 |
| 6 | 26-30 | 33 | 3 | 33 | 73 | 38 | 67 |
| 7 | 31-35 | 33 | 5 | 37 | 73 | 45 | 69 |
| 8 | 36-40 | 33 | 5 | 30 | 73 | 53 | 72 |
| 9 | 41-45 | 33 | 3 | 28 | 73 | 57 | 68 |
| 10 | 46-46 | 33 | 3 | 33 | 73 | 60 | 68 |

Ranks within +-10 of target after: mid 9/10, mastery 8/10.

### knight

Knob changes (value at the anchor level; levels between anchors blend linearly, L1-5 is the novice blend off the L6 anchor):

| anchor | knob | current | proposed |
|---|---|---|---|
| easy (L6) | aggression | 0.45 | 0.6 |
| normal (L18) | aggression | 0.65 | 0.8 |
| hard (L46) | aggression | 0.85 | 1 |
| hard (L46) | pressure | 0.5 | 0.35 |
| body | health | 160 | 80 |

Win % by level (checkpoints). before = baseline 30 seeds, after = proposal 40 seeds; target = pooled curve.

| bot | L1 | L2 | L3 | L5 | L8 | L10 | L15 | L20 | L30 | L46 |
|---|---|---|---|---|---|---|---|---|---|---|
| mid target | 50 | 44 | 39 | 35 | 33 | 33 | 33 | 33 | 33 | 33 |
| mid before | 27 | 7 | 10 | 20 | 3 | 7 | 0 | 0 | 10 | 17 |
| mid after | 68 | 60 | 50 | 33 | 40 | 38 | 35 | 43 | 40 | 50 |
| mastery target | 93 | 88 | 84 | 82 | 79 | 77 | 75 | 73 | 73 | 73 |
| mastery before | 97 | 90 | 83 | 100 | 90 | 83 | 63 | 77 | 33 | 43 |
| mastery after | 100 | 100 | 100 | 100 | 100 | 100 | 98 | 98 | 100 | 98 |

Per-rank mean win % (all levels of the rank, 5 levels x 40 seeds = 200 fights, SE about 3 points):

| rank | levels | mid target | mid before | mid after | mastery target | mastery before | mastery after |
|---|---|---|---|---|---|---|---|
| 1 | 1-5 | 41 | 15 | 51 | 86 | 93 | 100 (out) |
| 2 | 6-10 | 33 | 3 | 36 | 79 | 84 | 100 (out) |
| 3 | 11-15 | 33 | 1 | 38 | 76 | 73 | 98 (out) |
| 4 | 16-20 | 33 | 1 | 41 | 74 | 69 | 95 (out) |
| 5 | 21-25 | 33 | 3 | 35 | 73 | 58 | 96 (out) |
| 6 | 26-30 | 33 | 7 | 34 | 73 | 55 | 96 (out) |
| 7 | 31-35 | 33 | 3 | 43 | 73 | 54 | 95 (out) |
| 8 | 36-40 | 33 | 4 | 53 (out) | 73 | 49 | 96 (out) |
| 9 | 41-45 | 33 | 9 | 45 (out) | 73 | 36 | 96 (out) |
| 10 | 46-46 | 33 | 17 | 50 (out) | 73 | 43 | 98 (out) |

Ranks within +-10 of target after: mid 7/10, mastery 0/10.

### shieldmaiden

Knob changes (value at the anchor level; levels between anchors blend linearly, L1-5 is the novice blend off the L6 anchor):

| anchor | knob | current | proposed |
|---|---|---|---|
| easy (L6) | pressure | 0.6 | 0.7 |
| normal (L18) | pressure | 0.7 | 0.8 |
| hard (L46) | pressure | 0.75 | 0.85 |
| body | health | 190 | 175 |

Win % by level (checkpoints). before = baseline 30 seeds, after = proposal 40 seeds; target = pooled curve.

| bot | L1 | L2 | L3 | L5 | L8 | L10 | L15 | L20 | L30 | L46 |
|---|---|---|---|---|---|---|---|---|---|---|
| mid target | 50 | 44 | 39 | 35 | 33 | 33 | 33 | 33 | 33 | 33 |
| mid before | 43 | 50 | 27 | 33 | 20 | 10 | 17 | 27 | 20 | 23 |
| mid after | 53 | 48 | 45 | 28 | 38 | 25 | 38 | 38 | 38 | 33 |
| mastery target | 93 | 88 | 84 | 82 | 79 | 77 | 75 | 73 | 73 | 73 |
| mastery before | 87 | 80 | 50 | 70 | 73 | 73 | 70 | 70 | 70 | 73 |
| mastery after | 80 | 80 | 75 | 80 | 85 | 88 | 75 | 78 | 93 | 98 |

Per-rank mean win % (all levels of the rank, 5 levels x 40 seeds = 200 fights, SE about 3 points):

| rank | levels | mid target | mid before | mid after | mastery target | mastery before | mastery after |
|---|---|---|---|---|---|---|---|
| 1 | 1-5 | 41 | 34 | 40 | 86 | 71 | 77 |
| 2 | 6-10 | 33 | 19 | 32 | 79 | 70 | 83 |
| 3 | 11-15 | 33 | 16 | 37 | 76 | 77 | 84 |
| 4 | 16-20 | 33 | 23 | 36 | 74 | 75 | 87 (out) |
| 5 | 21-25 | 33 | 20 | 34 | 73 | 74 | 93 (out) |
| 6 | 26-30 | 33 | 21 | 37 | 73 | 79 | 93 (out) |
| 7 | 31-35 | 33 | 19 | 36 | 73 | 79 | 88 (out) |
| 8 | 36-40 | 33 | 16 | 33 | 73 | 75 | 87 (out) |
| 9 | 41-45 | 33 | 18 | 33 | 73 | 85 | 91 (out) |
| 10 | 46-46 | 33 | 23 | 33 | 73 | 73 | 98 (out) |

Ranks within +-10 of target after: mid 10/10, mastery 3/10.

## Gates

### Tap-attack L1 gate, before (24 seeds)

| opponent | L1 wins | L2 | L3 |
|---|---|---|---|
| veteran | 24/24 | 24/24 | 24/24 |
| nightborn | 24/24 | 24/24 | 24/24 |
| plaguedoctor | 24/24 | 24/24 | 24/24 |
| witch | 24/24 | 22/24 | 21/24 |
| goblin | 22/24 | 23/24 | 20/24 |
| pitborn | 24/24 | 24/24 | 24/24 |
| executioner | 21/24 | 22/24 | 17/24 |
| dwarf | 24/24 | 24/24 | 23/24 |
| knight | 24/24 | 24/24 | 24/24 |
| shieldmaiden | 24/24 | 24/24 | 24/24 |

### Tap-attack L1 gate, after (24 seeds)

| opponent | L1 wins | L2 | L3 |
|---|---|---|---|
| veteran | 24/24 | 24/24 | 23/24 |
| nightborn | 24/24 | 24/24 | 24/24 |
| plaguedoctor | 24/24 | 24/24 | 22/24 |
| witch | 24/24 | 22/24 | 19/24 |
| goblin | 22/24 | 17/24 | 14/24 |
| pitborn | 24/24 | 24/24 | 24/24 |
| executioner | 24/24 | 23/24 | 23/24 |
| dwarf | 24/24 | 24/24 | 23/24 |
| knight | 24/24 | 24/24 | 24/24 |
| shieldmaiden | 24/24 | 24/24 | 24/24 |

### No-strategy over 80 % guard (24 seeds per row; 8 scripted no-skill strategies incl. tap attack, levels 1,2,3,4,5,6,8,10,12,15,18,22,26,30,38,46)

Rows over 80 % at L6 and above (the ladder proper). L1-5 is the novice ramp where the tap attack must win, so those rows are expected and only counted.

| opponent | before: rows over 80 % at L6+ | after: rows over 80 % at L6+ | before L1-5 count | after L1-5 count |
|---|---|---|---|---|
| veteran | light spam L6 21/24; light spam L8 20/24; tap attack L6 23/24; tap attack L8 21/24; tap attack L10 20/24 | tap attack L8 21/24 | 27 | 25 |
| nightborn | thrust from range L6 20/24 | none | 26 | 21 |
| plaguedoctor | none | thrust from range L8 20/24 | 26 | 22 |
| witch | none | none | 26 | 24 |
| goblin | kick only L6 24/24; kick only L8 24/24; kick only L10 24/24; kick only L12 23/24 | kick only L6 22/24; kick only L8 22/24; kick only L10 23/24; kick only L12 23/24 | 22 | 14 |
| pitborn | light spam L6 24/24; light spam L8 23/24; light spam L10 21/24; light spam L12 23/24; held lights L6 21/24; held lights L8 24/24; tap attack L6 20/24 | light spam L6 24/24; light spam L8 24/24; light spam L10 24/24; light spam L12 24/24; held lights L6 22/24; held lights L8 24/24; charged heavy only L6 22/24; charged heavy only L10 20/24; tap attack L6 24/24; tap attack L8 24/24; tap attack L10 20/24; tap attack L12 20/24 | 25 | 25 |
| executioner | none | light spam L6 23/24; light spam L8 21/24; charged heavy only L6 20/24; charged heavy only L8 21/24 | 17 | 24 |
| dwarf | light spam L6 22/24; light spam L10 21/24 | light spam L6 22/24; light spam L8 21/24; light spam L10 21/24; charged heavy only L6 22/24; tap attack L6 21/24 | 26 | 25 |
| knight | light spam L6 24/24; light spam L8 23/24; light spam L10 20/24; charged heavy only L8 21/24; tap attack L6 20/24 | light spam L6 24/24; light spam L8 24/24; light spam L10 24/24; heavy only L6 21/24; charged heavy only L6 23/24; charged heavy only L8 23/24; charged heavy only L10 22/24; charged heavy only L12 23/24; charged heavy only L15 23/24; tap attack L6 24/24; tap attack L8 24/24; tap attack L10 21/24 | 31 | 33 |
| shieldmaiden | light spam L6 23/24; light spam L8 20/24; light spam L10 22/24; held lights L6 22/24; charged heavy only L6 20/24; tap attack L6 20/24 | light spam L6 23/24; light spam L8 24/24; light spam L10 22/24; light spam L12 20/24; held lights L6 23/24; charged heavy only L6 21/24; tap attack L6 23/24; tap attack L10 20/24 | 27 | 28 |

## Nightborn vs Plague Doctor behaviour (mid bot, 20 seeds, per fight averages)

| opponent | state | level | lights | heavies | thrusts | kicks | parries | rolls | backsteps | hits landed | ticks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| nightborn | before | L6 | 9.7 | 1.4 | 4.2 | 0.7 | 0.1 | 0 | 0 | 11.6 | 1776.8 |
| nightborn | before | L18 | 9.6 | 1.6 | 3.9 | 0.9 | 0.1 | 0 | 0 | 11 | 1727.7 |
| nightborn | before | L46 | 11.4 | 1.3 | 3.1 | 0.7 | 0.3 | 0 | 0 | 11.8 | 1679.7 |
| nightborn | after | L6 | 11.5 | 1.5 | 5 | 0.8 | 0.1 | 0 | 0 | 13.5 | 2101.2 |
| nightborn | after | L18 | 12 | 3 | 5.5 | 0.7 | 2.5 | 0 | 0 | 13.4 | 2357.1 |
| nightborn | after | L46 | 13 | 1.9 | 6.1 | 0.3 | 3.5 | 0 | 0 | 13.2 | 2219.9 |
| plaguedoctor | before | L6 | 9.7 | 1.4 | 4.2 | 0.7 | 0.1 | 0 | 0 | 11.6 | 1776.8 |
| plaguedoctor | before | L18 | 9.6 | 1.6 | 3.9 | 0.9 | 0.1 | 0 | 0 | 11 | 1727.7 |
| plaguedoctor | before | L46 | 11.4 | 1.3 | 3.1 | 0.7 | 0.3 | 0 | 0 | 11.8 | 1679.7 |
| plaguedoctor | after | L6 | 13.2 | 2.3 | 4.1 | 0.4 | 1.3 | 0 | 3.1 | 13.8 | 2436.1 |
| plaguedoctor | after | L18 | 14.1 | 1.8 | 4.5 | 0.5 | 2.5 | 0 | 3.2 | 12.8 | 2437.2 |
| plaguedoctor | after | L46 | 17.6 | 2.3 | 5.4 | 0.2 | 7.1 | 0 | 4.3 | 13.3 | 2804.2 |