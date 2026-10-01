# Specials: final spec and the evidence for it (2026-10-01, Dom's numbers)

Stats lane, for Combat to build from. Every number is Dom's (relayed by Strategy 2026-10-01); his final answer on the interrupt is NO. This replaces an earlier 30 % / 15 s lock and the interrupt variants studied on the way. Nothing in `src/` was changed by this study; the harness is `scripts/special-balance.ts` on branch `stats/special-balance` @ 841e2c1c (an analysis script, deliberately not merged so this PR stays docs-only: `git show origin/stats/special-balance:scripts/special-balance.ts`).

## SPEC

| Rule | Value |
|---|---|
| Boss special | ranks 8-10: 25 % of the player's max health |
| Class special | ranks 1-7: 20 % of max health |
| Cadence | any special once every 20 s: first use 20 s into the fight (1200 ticks), re-arm 20 s (1200 ticks) after a release |
| Unblockable | all specials: not blockable, not dodgeable, and **cannot be interrupted once started** |
| Wind-up | 2 s (120 ticks). The caster cannot block or dodge in it and takes normal hits; none of them stops the special |
| Tell | the presentation clips are the visible tell |
| Recovery | after the special lands the caster does not attack until the special's presentation ends: 45 ticks in the sim (today the AI attacks 18 ticks after Blood Tithe lands). Defence and movement stay as the AI decides |
| Intent | meant to feel powerful; it can be the kill shot |

Fallback if it plays too strong: 15 % / 20 % and every 30 s (Dom). Measured below ("Fallback (measured)").

## Measured result

n=300 per cell (10 ladder opponents × 30 seeds), ranks 8 / 9 / 10, win %, 25 % boss special, 20 s first use and re-arm, 45-tick recovery, no interrupt. Bots: the scripts in `tests/strategies.ts` plus **mid** = perfect parry answering each swing with probability 0.3 (a 35 % base win), **rush** = close and throw a plain heavy in the wind-up (naive), **timed** = close and time the heavy late in the wind-up (informed). "mastery" = the perfect-parry script. The class column is the 20 % special run at the same ranks 8-10 as a stand-in; the class special's own ranks 1-7 are measured in the next section.

| bot | no special | boss 25 % | class 20 % (stand-in) |
|---|---|---|---|
| mastery, plain (does not react) | 71 / 69 / 71 | 58 / 57 / 56 | 61 / 59 / 58 |
| mid, plain | 35 / 35 / 35 | 20 / 19 / 19 | 23 / 22 / 23 |
| mastery + rush (naive) | 71 / 69 / 71 | 70 / 72 / 75 | 73 / 76 / 77 |
| mid + rush (naive) | 35 / 35 / 35 | 26 / 27 / 27 | 30 / 30 / 30 |
| mastery + timed (informed) | 71 / 69 / 71 | 68 / 67 / 72 | 68 / 69 / 74 |
| mid + timed (informed) | 35 / 35 / 35 | 24 / 24 / 24 | 29 / 26 / 28 |

How often it happens (ranks pooled, boss 25 %): the special fires in 69 % (mastery) and 75 % (mid) of fights for a player who does not react, and 56-74 % for the reacting bots. It is the killing blow in 18 % (mastery) and 34 % (mid) of that player's losses (8 % and 27 % of all his fights), and 23-25 % (mastery) and 33 % (mid) of the reacting bots' losses.

What it says:
- It is a real cost for everyone: a player who does not react loses 13-15 points (mastery) and 15-16 (mid) at 25 %, 10-13 and 12-13 at 20 %.
- A reacting player is only slightly better off than one who ignores it (mid: 24 against 20 at 25 %), and the informed mid-skill player ends 11 points under his no-special win (24 against 35). The naive mastery rusher is level with his no-special win or above it (70 / 72 / 75), because the recovery opens a free window he attacks into.
- No rung becomes unwinnable for the mastery bot (lowest cell 56 %); the mid-skill bot's win falls by roughly 45 % (35 to 19-20).
- If it plays too strong, Dom's fallback (15 % every 30 s) is the lever; 20 % damage alone gives back only 3-4 points.

## Class special 20 % at ranks 1 / 3 / 5 / 7 (measured)

Same harness, bots, 20 s first use and re-arm, 45-tick recovery and no interrupt; n=300 per cell (10 ladder opponents × 30 seeds), win %, rank 1 / 3 / 5 / 7 (levels 5 / 15 / 25 / 35).

| bot | no special | class 20 % | fires (% of fights) | killing blow (% of losses) |
|---|---|---|---|---|
| mastery, plain (does not react) | 88 / 74 / 74 / 69 | 76 / 65 / 63 / 64 | 87 / 75 / 78 / 73 | 13 / 6 / 10 / 11 |
| mid, plain | 36 / 32 / 33 / 30 | 20 / 19 / 22 / 20 | 90 / 80 / 74 / 77 | 25 / 28 / 24 / 29 |
| mastery + rush (naive) | 88 / 74 / 74 / 69 | 87 / 80 / 77 / 79 | 68 / 60 / 64 / 58 | 8 / 15 / 20 / 16 |
| mid + rush (naive) | 36 / 32 / 33 / 30 | 37 / 29 / 28 / 29 | 88 / 77 / 74 / 76 | 23 / 25 / 22 / 29 |
| mastery + timed (informed) | 88 / 74 / 74 / 69 | 84 / 72 / 72 / 74 | 84 / 68 / 72 / 65 | 14 / 10 / 17 / 14 |
| mid + timed (informed) | 36 / 32 / 33 / 30 | 25 / 25 / 24 / 23 | 90 / 80 / 74 / 77 | 23 / 25 / 21 / 28 |

What it says: the same shape as the boss special at ranks 8-10, one step gentler. A player who does not react loses 5-12 points (mastery; 12 at rank 1, 5 at rank 7) and 10-16 (mid-skill). Reacting mastery players land between 4 under and 10 over their no-special win (naive 77-87, informed 72-84); reacting mid-skill players end within 5 of it when naive (28-37) and 7-11 under it when informed (23-25 against 30-36). The special fires in 58-90 % of fights, because fights at these ranks run about 26-34 s; it is the killing blow in 6-29 % of losses. No rank is unwinnable for the mastery bot (lowest cell 63 %); the plain mid-skill bot falls to about 20 %.
The mid-skill bot (a 0.3 parry chance) was calibrated at ranks 8-10 and happens to give 30-36 % base wins at these ranks too.

## Fallback (measured): 15 % boss (ranks 8-10) / 20 % class (ranks 1-7), every 30 s

Dom's fallback if the spec plays too strong: first use at 30 s (1800 ticks), re-arm 30 s, no interrupt, 45-tick recovery kept. Same harness and bots; n=300 per cell; win %, ranks 1 / 3 / 5 / 7 / 8 / 9 / 10.

| bot | no special | fallback | fires (% of fights) | killing blow (% of losses) |
|---|---|---|---|---|
| mastery, plain (does not react) | 88 / 74 / 74 / 69 / 71 / 69 / 71 | 80 / 68 / 67 / 64 / 68 / 69 / 69 | 36 / 27 / 28 / 19 / 18 / 15 / 19 | 36 / 35 / 40 / 22 / 27 / 18 / 21 |
| mid, plain | 36 / 32 / 33 / 30 / 35 / 35 / 35 | 26 / 23 / 25 / 24 / 32 / 31 / 31 | 48 / 29 / 26 / 22 / 19 / 21 / 21 | 26 / 25 / 18 / 18 / 12 / 17 / 18 |
| mastery + rush (naive) | 88 / 74 / 74 / 69 / 71 / 69 / 71 | 87 / 78 / 76 / 71 / 74 / 74 / 75 | 27 / 17 / 17 / 12 / 10 / 10 / 11 | 36 / 35 / 33 / 21 / 19 / 10 / 14 |
| mid + rush (naive) | 36 / 32 / 33 / 30 / 35 / 35 / 35 | 33 / 29 / 32 / 28 / 34 / 35 / 37 | 46 / 25 / 22 / 20 / 17 / 19 / 17 | 25 / 22 / 15 / 16 / 9 / 14 / 14 |
| mastery + timed (informed) | 88 / 74 / 74 / 69 / 71 / 69 / 71 | 85 / 77 / 76 / 70 / 74 / 73 / 74 | 33 / 18 / 17 / 14 / 11 / 11 / 13 | 38 / 35 / 35 / 20 / 21 / 12 / 15 |
| mid + timed (informed) | 36 / 32 / 33 / 30 / 35 / 35 / 35 | 26 / 27 / 28 / 26 / 32 / 34 / 37 | 48 / 26 / 22 / 21 / 17 / 20 / 18 | 24 / 21 / 14 / 15 / 9 / 14 / 14 |

What it says: the fallback is a much lighter special, mostly because of the cadence. Fights run about 26-29 s without it, so the first use at 30 s arrives in only 10-48 % of fights (36-48 % at rank 1, 10-21 % at ranks 8-10). A player who does not react loses 0-8 points (mastery) and 3-10 (mid-skill), against 13-16 at ranks 8-10 and 5-16 at ranks 1-7 under the 25 % / 20 % spec at 20 s. When it does fire it is as deadly as before: the killing blow in 9-40 % of losses. Reacting mastery players land between 3 under and 5 over their no-special win; informed mid-skill players are 10 under at rank 1, 3-5 under at ranks 3-8, 1 under at rank 9 and 2 over at rank 10; naive mid-skill players are within 3 of it. If this fallback is used, expect the special to be rare, and the first-use time (not the damage) is what makes it so.

## How the numbers were reached (history)

1. A first study at 30 % damage, 20 s re-arm, no interrupt: mastery 71 / 69 / 71 fell to 55 / 58 / 59; the special was the killing blow in 14-22 % of losses; the caster died in the wind-up in under 1 % of wind-ups.
2. Interrupt variants (any heavy; charged-only; poise 60/40 and 70/30; poise plus a caster that blocks part of the open window) were measured. Poise 70/30 with a 30 % block held an informed player at about his no-special win, which made the interrupt look workable. Dom ruled it out: specials cannot be interrupted.
3. The 45-tick recovery, then Dom's corrected numbers (above).

## Caveats

- The fallback numbers carry the same caveats; its low fire rate means each cell rests on far fewer fights where the special actually happened (about 30-140 per cell).
- Damage is taken as a share of the PLAYER's max health (100). Gear and tier are not in the sim (gear stats are parked), so "the hero at a matching tier" is the same unequipped hero.
- The caster idles in the wind-up. A caster that moves or defends there would take fewer hits.
- The bots are scripts with perfect knowledge of the tell, not people. 30 seeds per opponent gives about ±9 points per opponent cell and about ±3 across ten opponents.
- The plain bots win only by parrying the caster's swings; the 45-tick recovery removes the swings they react to, so it lowers their win while it helps a bot that attacks in the window. A person who attacks in the recovery gains more than the table shows.
- The special is modelled as one instant hit on release; no animation, camera or audio.

## Re-running

Check out `origin/stats/special-balance` @ 841e2c1c, then:

```
node --experimental-strip-types scripts/special-balance.ts <opponent> 30 dom 0.3
```
prints one JSON line per opponent (`rank|variant|bot` cells; the `D25 no-interrupt` and `D20 no-interrupt` variants are the table above). Run it on the VPS at nice 19 (never on the Mac during a release). Earlier modes in the same file: no argument, `interrupt`, `poise`, `block`, `final`; `class` runs the class special at ranks 1/3/5/7;  `fallback` runs Dom's fallback at ranks 1/3/5/7/8/9/10.
