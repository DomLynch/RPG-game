# RV31 — L6 anti-spam (design, direction APPROVED by Strategy 2026-10-07; no src until RV30 is open and RV29 is merged)

**Strategy's rules:** AI knobs only, body stats (poise) stay identity: if AI knobs cannot reach < 80 % come back with the numbers. **Floor:** the beginner human-bot's (tap-attack first-timer's) win rate at L1 must not fall by more than 5 points per opponent. One commit per opponent; REACH[31] exact; a per-opponent L6 cap test.

**Problem (measured at the RV29 head cf49bc1f, `scripts/light-spam-l6.mjs`, 24 seeds):** the light-spam script wins L6 against veteran 23/24 (96 %), pitborn 24, knight 24, shieldmaiden 24 (100 %) and dwarf 20 (83 %); pooled over the ten opponents 57 %. Goblin 11, executioner 8, witch 3, nightborn 0, plaguedoctor 0 are fine. **Goal: no opponent above 80 % at L6 for light spam, with the pooled skilled-bot caps (ladder-human, opponents, ladder-battery) unchanged.**

**Where L6 lives.** `LEVEL_ANCHORS.easy = 6`: L6 is exactly `o.profiles.easy`. Anything set on an easy row also moves the blend L1 -> L6 (novice) and L6 -> L18, so every change is measured at L1, L6, L12 and L18, not only L6. Rows change AI numbers only, never a move timing.

**The existing spammer read (src/ai.ts).** It needs evidence first: `READ.swings` 11 swings of which `READ.lightShare` .7 are lights, so a fast spam can finish the fight before the read starts. Once on: the cut is noticed at `min(reaction, profile.anticipate ?? READ.anticipate 8)` ticks, the lapse halves, the parry chance is `min(.85, 1 - dodge, parry x 2)`, a heavy becomes a cut, and the warden walks in guard inside cutting range. At the easy row the parry is .05-.1, so x2 is still .1-.2: the read is nearly inert at L6.

**Candidate knobs, per opponent (easy rows; all existing fields, no new rule):**

| Opponent | Today (easy row) | Candidate | Why |
|---|---|---|---|
| veteran (96 %) | PROFILES.easy: reaction 24, parry .1, lapse .45, anticipate absent (8) | anticipate 5, parry .15 | the read engages sooner and parries a little more |
| pitborn (100 %) | reaction 28, parry .05, lapse .45; poise ramps 0 -> 16 by L18 | anticipate 5, parry .12; no poise change (ruled out) | at L6 a light staggers his low poise |
| shieldmaiden (100 %) | the Pitborn copy (RV30 row keeps easy as is) | same as pitborn; her easy row is her own now, so it moves alone | |
| knight (100 %) | PROFILES.easy | anticipate 4, lapse .35 (the Executioner's normal answer: anticipate 3 + lapse .2 took cut spam from 18/24 to 8) | same archetype, same fix |
| dwarf (83 %) | his own easy row | anticipate 6 only | already near the cap; the smallest change |

**Plan.** (1) A probe per opponent at L1/L6/L12/L18 with `scripts/own-row-battery.mjs` style output for 'light spam', 'tap attack' and the skilled human-like bots (ladder-human), before/after, 24 seeds (48 where a cell sits within 3 of the cap). (2) Start from the single knob `anticipate` (it only acts on a read spammer, so it cannot touch the other scripts), add `parry` only where it does not reach 80. (3) One commit per opponent so one can be dropped. (4) RV31 bump with REACH[31] naming exactly the opponents changed, from level 1. (5) The 'light spam' cap per opponent at L6 becomes a test row so it cannot drift back.

**Risks.** Easy rows are the ladder's friendliest rungs: lowering the win rate of a mashing first-timer must not push the L1 tap-attack gate (the first-timer's win rate) under its floor. Evidence-first means a spam that mixes in a heavy or a thrust resets the read: the fix helps pure mashers only, which is the script in the cap.
