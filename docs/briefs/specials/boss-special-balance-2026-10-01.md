# Specials: final spec and the evidence for it (2026-10-01, Dom's numbers)

Stats lane, for Combat to build from. Every number is Dom's (relayed by Strategy 2026-10-01); his final answer on the interrupt is NO. This replaces an earlier 30 % / 15 s lock and the interrupt variants studied on the way. Nothing in `src/` was changed by this study; the harness is `scripts/special-balance.ts` on branch `stats/special-balance` @ 272f8e06 (an analysis script, deliberately not merged so this PR stays docs-only: `git show origin/stats/special-balance:scripts/special-balance.ts`).

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

Fallback if it plays too strong: 15 % / 20 % and every 30 s (Dom). Not measured; the 20 % rows below show the 20 %-damage direction only.

## Measured result

n=300 per cell (10 ladder opponents × 30 seeds), ranks 8 / 9 / 10, win %, 25 % boss special, 20 s first use and re-arm, 45-tick recovery, no interrupt. Bots: the scripts in `tests/strategies.ts` plus **mid** = perfect parry answering each swing with probability 0.3 (a 35 % base win), **rush** = close and throw a plain heavy in the wind-up (naive), **timed** = close and time the heavy late in the wind-up (informed). "mastery" = the perfect-parry script. The class row is the 20 % special run at the same ranks 8-10 as a stand-in; ranks 1-7, where it will actually be used, were not run.

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
- It is a real cost for everyone: a player who does not react loses 13-15 points (mastery) and 15-16 (mid) at 25 %, 9-13 and 12-13 at 20 %.
- A reacting player is only slightly better off than one who ignores it (mid: 24 against 20 at 25 %), and the informed mid-skill player ends 11 points under his no-special win (24 against 35). The naive mastery rusher is level with his no-special win or above it (70 / 72 / 75), because the recovery opens a free window he attacks into.
- No rung becomes unwinnable for the mastery bot (lowest cell 56 %); the mid-skill bot's win falls by roughly 45 % (35 to 19-20).
- If it plays too strong, Dom's fallback (15 % every 30 s) is the lever; 20 % damage alone gives back only 3-4 points.

## How the numbers were reached (history)

1. A first study at 30 % damage, 20 s re-arm, no interrupt: mastery 71 / 69 / 71 fell to 55 / 58 / 59; the special was the killing blow in 14-22 % of losses; the caster died in the wind-up in under 1 % of wind-ups.
2. Interrupt variants (any heavy; charged-only; poise 60/40 and 70/30; poise plus a caster that blocks part of the open window) were measured. Poise 70/30 with a 30 % block held an informed player at about his no-special win, which made the interrupt look workable. Dom ruled it out: specials cannot be interrupted.
3. The 45-tick recovery, then Dom's corrected numbers (above).

## Caveats

- Damage is taken as a share of the PLAYER's max health (100). Gear and tier are not in the sim (gear stats are parked), so "the hero at a matching tier" is the same unequipped hero.
- The caster idles in the wind-up. A caster that moves or defends there would take fewer hits.
- The bots are scripts with perfect knowledge of the tell, not people. 30 seeds per opponent gives about ±9 points per opponent cell and about ±3 across ten opponents.
- The plain bots win only by parrying the caster's swings; the 45-tick recovery removes the swings they react to, so it lowers their win while it helps a bot that attacks in the window. A person who attacks in the recovery gains more than the table shows.
- The special is modelled as one instant hit on release; no animation, camera or audio. The class special is a stand-in at ranks 8-10, not run at ranks 1-7.

## Re-running

Check out `origin/stats/special-balance` @ 272f8e06, then:

```
node --experimental-strip-types scripts/special-balance.ts <opponent> 30 dom 0.3
```
prints one JSON line per opponent (`rank|variant|bot` cells; the `D25 no-interrupt` and `D20 no-interrupt` variants are the table above). Run it on the VPS at nice 19 (never on the Mac during a release). Earlier modes in the same file: no argument, `interrupt`, `poise`, `block`, `final`.
