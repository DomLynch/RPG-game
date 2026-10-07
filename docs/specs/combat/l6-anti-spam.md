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

## Sweep results (VPS probes, no src commit; `ladder-human` n = 120 per cell, light spam n = 48; Strategy's guardrails: honest win rate at L1, L6 and L12 each down at most 5 points, light spam at L6 under 38/48 for every opponent, Shieldmaiden included)

Probe patches (scratch clone only): a per-fight habit `run` (consecutive lights) in `src/ai.ts` and a replaceable `spammer` read. Baseline = today's read (11 swings, 70 % lights) = spam 43/48 veteran, 48 pitborn, 48 shieldmaiden, 48 knight, 41 dwarf.

1. **Global faster `reaction` on the easy row (14 / 16 / 18, lapse, parry): REJECTED.** Spam falls (reaction 14 + lapse .2 + parry .2: 1 / 11 / 11 / 8 / 9) but the honest bots collapse (veteran blocker L6 95 -> 8, shieldmaiden blocker L6 80 -> 18): a difficulty retune, not anti-spam.
2. **Read-gated, replacing the read (spammer = 5 swings at 70 % lights, or 5 consecutive lights, AND the player has not yet guarded / parried / rolled / stepped in the fight), the existing `anticipate` 8 then applies only while it is on:** spam L6 19 / 33-35 / 31-34 / 36 / 29-30 (all under 38). Honest bots (blocker L6/L12, skilled L6/L12, base -> variant): veteran 90/63, 98/91 -> 98/83, 95/91; pitborn 58/40, 63/54 -> 58/55, 57-58/60; knight 63/38, 62/25 -> 68/42, 68/43; dwarf 83/50, 52/24 -> 83/59, 70/40: all within the 5-point rule (most rise: the old read punished cut-heavy honest players). **Fails the rule:** Shieldmaiden blocker 81/82 -> 72/70-71 (-9 / -11) and skilled L12 97 -> 91 (-6), Pitborn skilled L6 63 -> 57-58 (-5 to -6, at the edge of noise: n = 120 gives about +/-4.5 points).
3. **Consecutive 3 (spam 12 / 28 / 29 / 23 / 18) instead of 5:** lowers spam further but breaks the rule more (shieldmaiden blocker 65/50, dwarf blocker 64/41).
4. **Later gates (7 / 9 / 12 consecutive) on Shieldmaiden and Pitborn:** spam stays 47-48/48 (the read is inert that late) and the Shieldmaiden blocker still sits at 65-70 at L6, so the drop is the loss of the OLD read, not the new one.
5. **Keeping the old read and ADDING the early gate (OR):** keeps Shieldmaiden whole (blocker 80/81, skilled 93/90) but punishes honest players who open with 5 cuts before their first defensive move (veteran blocker L6 90 -> 80, knight skilled L6 62 -> 49, dwarf blocker L6 83 -> 62): fails the rule on four opponents.

**Where this leaves RV31:** the read gate (item 2) is the only lever that clears the spam target for all five, Shieldmaiden included, and it nearly clears the honest rule, but it is a SHARED RULE (ai.ts `readOpponent`: a different spammer definition for every opponent and level), not a per-opponent profile number, so it needs an RV bump whose REACH names every opponent (like RV29) and the full gate suite (battery, ladder-battery, ladder-human, opponents, player-weapons) rerun before it can be called safe; and it still misses the rule for the Shieldmaiden blocker (-9 / -11) and, at the edge of noise, the Pitborn skilled bot. Decision needed from Strategy: accept the Shieldmaiden / Pitborn cells as a one-off exception, or take the per-opponent route (a profile knob `spamRun` read by the same gate, absent = today's read) and tune Shieldmaiden separately.

## FINAL (Strategy ruling 2026-10-07: per-opponent `spamRun`, no exception; built on `combat/rv31` off #1564)

**Knob:** `AiProfile.spamRun` (absent = today's read, byte for byte) and `spamBoth` (1 = keep the old read as well). Early gate = `spamRun` consecutive lights before the player has guarded, parried, rolled or stepped once; it REPLACES the old read except where `spamBoth` is set (the Shieldmaiden). Set on all three tiers via `OWN_KNOBS`, so every level carries it. REACH[31] = those five from level 1; every other opponent (goblin, nightborn, executioner, witch, plaguedoctor, ...) reads exactly as before.

**Per-opponent table, measured on the real branch (VPS, light spam n = 120, honest bots n = 120; base = #1564 head a592dc7f):**

| Opponent | spamRun | light spam L6 (cap 96/120 = 80 %) | blocker L6 / L12 | skilled L6 / L12 | honest rule (down at most 5 at L1, L6, L12) |
|---|---|---|---|---|---|
| veteran | 5 | 107 -> 40 | 90/63 -> 98/83 | 98/91 -> 95/91 | pass (L6 skilled -3) |
| knight | 5 | 120 -> 84 | 63/38 -> 68/42 | 62/25 -> 68/43 | pass |
| dwarf | 5 | 102 -> 66 | 83/50 -> 83/59 | 52/24 -> 70/40 | pass |
| shieldmaiden | 5 + old read | 119 -> 81 | 81/82 -> 80/81 | 94/97 -> 93/90 | pass at n = 120 except skilled L12 -7; re-measured at n = 240: skilled L12 94 -> 90 (-4), blocker L12 79 -> 75 (-4): pass |
| pitborn | 6 | 116 -> 88 | 58/40 -> 63/53 | 63/54 -> 58/56 | **MISS by 1 point, reported**: skilled L6 at n = 240: base 70, gate 5 -> 61 (-9), gate 6 -> 64 (-6), gate 7 -> 66 (-4) but light spam 47/48 (98 %, over the cap). Gate 6 is the smallest change that clears the cap (88/120 = 73 %) and it is -6 +/- 3 (one standard error at n = 240) on one cell |

L1 (measured on the real branch, n = 120, base -> gate): tap-attack first-timer 120/120 -> 120/120 for veteran, pitborn and shieldmaiden, knight 117 -> 120, dwarf 120 -> 118; light spam 120/120 everywhere before and after (the novice rung stays a win, by design); human-like blocker and skilled 100 at L1 in every row. Light spam target (under 80 % at L6 for every opponent, Shieldmaiden included): met for all five.

**Not measured:** L18-L50 honest bots (the gate is on every level; the full gate suite below is the check), and the human-like bots at L1/L6/L12 for the five only; the other nine opponents are unchanged by construction (absent knob).

**Ruling needed from Strategy:** the Pitborn skilled L6 cell is -6 (one point over the rule, within one standard error). Accept it, or go to gate 7 and lose the spam cap on her (98 %); there is no gate between 6 and 7.

**Plan.** (1) A probe per opponent at L1/L6/L12/L18 with `scripts/own-row-battery.mjs` style output for 'light spam', 'tap attack' and the skilled human-like bots (ladder-human), before/after, 24 seeds (48 where a cell sits within 3 of the cap). (2) Start from `reaction` (the measured lever; anticipate/parry do nothing at L6), then `lapse` / `parry`, smallest change that clears 80 %. (3) One commit per opponent so one can be dropped. (4) RV31 bump with REACH[31] naming exactly the opponents changed, from level 1. (5) The 'light spam' cap per opponent at L6 becomes a test row so it cannot drift back.

**Risks.** Easy rows are the ladder's friendliest rungs: lowering the win rate of a mashing first-timer must not push the L1 tap-attack gate (the first-timer's win rate) under its floor. Evidence-first means a spam that mixes in a heavy or a thrust resets the read: the fix helps pure mashers only, which is the script in the cap.

## FINAL-2 (Strategy ruling via Lead, 2026-10-07): p600 latch, shipped on `combat/rv31` @718f2198

Supersedes the gate-5/6 `spamRun` above. A counted defence (guard, parry, roll, step) adds 2 to `spamRun` for `READ.latch` = 600 ticks; Shieldmaiden `spamBoth`, Dwarf `spamRun` 6, Pitborn 6, Veteran and Knight 5. The hit-reactive variant (`combat/rv31-react` @cf2aee4d) failed the spam bar and is parked. K <= 600 is the loophole-test limit (K 750+ lets a masher with one real block per K ticks win about 87% vs Knight/Veteran); honest 5-light runs against a passive warden are byte-identical to a mash, so only a latch passes.

Light spam L6, n=120 (cap 96): veteran 40, pitborn 88, dwarf 66/74, knight 84, shieldmaiden 85.

Honest, n=240, L6/L12 (base in brackets): veteran blocker 89/65 [90/68], skilled 91/85 [95/89]; pitborn b 69/49 [64/42], s 64/55 [70/53]; dwarf b 80/61 [78/58], s 58/37 [49/25]; knight b 67/47 [61/38], s 56/29 [57/25]; shieldmaiden b 77/73 [80/79], s 92/88 [94/94]. n=480: pitborn b 73/50 [66/44], s 63/55 [71/52]; shieldmaiden b 81/73 [84/76], s 91/87 [95/92].

**Named exception to the -5 rule: PITBORN SKILLED L6, 63 vs 71 at n=480 (-8).** Gate 7 would give 69 but light spam 112/120 > 96 cap. Revisit with a different Pitborn knob only if the playtest says Pitborn feels unfair.
