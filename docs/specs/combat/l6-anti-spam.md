# RV31 — L6 anti-spam (design, direction APPROVED by Strategy 2026-10-07; no src until RV30 is open and RV29 is merged)

**Strategy's rules:** AI knobs only, body stats (poise) stay identity: if AI knobs cannot reach < 80 % come back with the numbers. **Floor:** the beginner human-bot's (tap-attack first-timer's) win rate at L1 must not fall by more than 5 points per opponent. One commit per opponent; REACH[31] exact; a per-opponent L6 cap test.

**Problem (measured at the RV29 head cf49bc1f, `scripts/light-spam-l6.mjs`, 24 seeds):** the light-spam script wins L6 against veteran 23/24 (96 %), pitborn 24, knight 24, shieldmaiden 24 (100 %) and dwarf 20 (83 %); pooled over the ten opponents 57 %. Goblin 11, executioner 8, witch 3, nightborn 0, plaguedoctor 0 are fine. **Goal: no opponent above 80 % at L6 for light spam, with the pooled skilled-bot caps (ladder-human, opponents, ladder-battery) unchanged.**

**Where L6 lives.** `LEVEL_ANCHORS.easy = 6`: L6 is exactly `o.profiles.easy`. Anything set on an easy row also moves the blend L1 -> L6 (novice) and L6 -> L18, so every change is measured at L1, L6, L12 and L18, not only L6. Rows change AI numbers only, never a move timing.

**The existing spammer read (src/ai.ts).** It needs evidence first: `READ.swings` 11 swings of which `READ.lightShare` .7 are lights, so a fast spam can finish the fight before the read starts. Once on: the cut is noticed at `min(reaction, profile.anticipate ?? READ.anticipate 8)` ticks, the lapse halves, the parry chance is `min(.85, 1 - dodge, parry x 2)`, a heavy becomes a cut, and the warden walks in guard inside cutting range. At the easy row the parry is .05-.1, so x2 is still .1-.2: the read is nearly inert at L6.

**Measured (VPS, 48 seeds, override-only probes: no src change; the five easy rows patched in memory).** Light-spam wins of 48 at L6, today -> variant (L1 stays 48/48 and the tap-attack first-timer stays 48, 48, 48, 46, 48 for veteran, pitborn, shieldmaiden, knight, dwarf in every variant below):

| Opponent | today | anticipate / parry candidates (this doc's first draft) | reaction 18 | reaction 14, lapse .2, parry .2 | reaction 10, lapse .1, parry .3 |
|---|---|---|---|---|---|
| veteran | 43 | anticipate 5: 47; anticipate 5 + parry .15: 47; anticipate 3 + parry .2: 43 | 12 | 1 | 0 |
| pitborn | 48 | anticipate 5: 47; + parry .12: 47; anticipate 3 + parry .2: 44 | 27 | 11 | 8 |
| shieldmaiden | 48 | all three: 48 | not run | not run | not run |
| knight | 48 | anticipate 4: 48; + lapse .35: 48; anticipate 3 + lapse .25: 47 | not run | 8 | 4 |
| dwarf | 41 | anticipate 6: 41; anticipate 4: 44 | not run | 9 | 7 |

**Finding: the first draft's knobs (anticipate, parry, lapse on the read) do nothing at L6.** The spammer read needs 11 swings and 70 % lights before it engages and the easy rows' reaction (24-28 ticks) is longer than a light's wind-up, so a mashing player lands cuts before the warden has noticed anything; anticipate/parry only act once the read is on. **The effective existing knob is the easy row's `reaction`** (with `lapse` and `parry`): reaction 14 + lapse .2 + parry .2 puts veteran at 1/48, pitborn 11, knight 8, dwarf 9 at L6 (all far under the 80 % cap, 38/48), and it also drops L12 (pitborn 42 -> 16, knight 44 -> 2). **Not yet measured, and the real risk:** a faster easy row also makes the rung harder for an honest first-time-to-intermediate player (ladder-human blocker / skilled bots at L6 and the L1 beginner bots), so the next step is a sweep of reaction 18 / 16 / 14 with lapse .3 / .2 and the human-like bots (`scripts/ladder-human.mjs`, L1 / L6 / L12) per opponent, choosing the smallest change that clears 80 % on light spam (pitborn needs more than reaction 18) while the human-bot floors hold (L1 not down by more than 5 points). Poise stays out (Strategy).

**Plan.** (1) A probe per opponent at L1/L6/L12/L18 with `scripts/own-row-battery.mjs` style output for 'light spam', 'tap attack' and the skilled human-like bots (ladder-human), before/after, 24 seeds (48 where a cell sits within 3 of the cap). (2) Start from `reaction` (the measured lever; anticipate/parry do nothing at L6), then `lapse` / `parry`, smallest change that clears 80 %. (3) One commit per opponent so one can be dropped. (4) RV31 bump with REACH[31] naming exactly the opponents changed, from level 1. (5) The 'light spam' cap per opponent at L6 becomes a test row so it cannot drift back.

**Risks.** Easy rows are the ladder's friendliest rungs: lowering the win rate of a mashing first-timer must not push the L1 tap-attack gate (the first-timer's win rate) under its floor. Evidence-first means a spam that mixes in a heavy or a thrust resets the read: the fix helps pure mashers only, which is the script in the cap.
