# Specials: balance spec and the evidence for it (2026-10-01, Dom's numbers)

Stats lane, for Combat to build from. Numbers are Dom's (relayed by Strategy 2026-10-01 and they replace an earlier 30 % / 15 s lock); the interrupt's shape was ruled by Strategy, and whether to KEEP the interrupt at all is **pending Dom** (both outcomes are measured below). Nothing in `src/` was changed by this study; the harness is `scripts/special-balance.ts` on branch `stats/special-balance` @ 272f8e06 (an analysis script, deliberately not merged so this PR stays docs-only: `git show origin/stats/special-balance:scripts/special-balance.ts`).

## SPEC

| Rule | Value |
|---|---|
| Boss special | ranks 8-10 (levels 40-46): 25 % of the player's max health |
| Class (non-boss) special | 20 % of max health |
| Cadence | any special once every 20 s: first use 20 s into the fight (1200 ticks), re-arm 20 s (1200 ticks) after a release or an interrupt |
| Unblockable | all specials: not blockable, not dodgeable, once released |
| Wind-up | 2 s (120 ticks). The caster cannot block or dodge in it and takes normal hits |
| Tell | the presentation clips are the visible tell |
| Poise | the first 70 % of the wind-up (84 ticks): the caster cannot be staggered; a hit there cancels nothing (its damage still lands) |
| Open window | the last 30 % (36 ticks): a landed heavy (the HUD heavy class), charged hit or guard break staggers him and cancels the special. **Interrupt = pending Dom's keep/drop** |
| Block | in the open window the caster blocks 30 % of hits; a blocked blow does nothing (no damage, no stagger, no cancel) and the special goes on |
| Recovery | after the special lands the caster may not start an attack for 45 ticks (today the AI attacks 18 ticks after Blood Tithe lands). Defence and movement stay as the AI decides |

## Result

n=300 per cell (10 ladder opponents × 30 seeds), ranks 8 / 9 / 10, win %. Bots: the scripts in `tests/strategies.ts` plus **mid** = perfect parry answering each swing with probability 0.3 (a 35 % base win), **rush** = close and throw a plain heavy in the wind-up (naive), **timed** = close and time the heavy to land once the poise window ends (informed). "mastery" = the perfect-parry script. The class row is the 20 % special run at the same ranks 8-10 as a stand-in; class specials at lower ranks were not run.

| bot | no special | boss 25 %, interrupt ON | boss 25 %, interrupt OFF | class 20 %, interrupt ON | class 20 %, interrupt OFF |
|---|---|---|---|---|---|
| mastery, plain (does not react) | 71 / 69 / 71 | 58 / 57 / 56 | 58 / 57 / 56 | 61 / 59 / 58 | 61 / 59 / 58 |
| mid, plain | 35 / 35 / 35 | 20 / 19 / 19 | 20 / 19 / 19 | 23 / 22 / 23 | 23 / 22 / 23 |
| mastery + rush (naive) | 71 / 69 / 71 | 71 / 68 / 71 | 70 / 72 / 75 | 72 / 70 / 73 | 73 / 76 / 77 |
| mid + rush (naive) | 35 / 35 / 35 | 29 / 28 / 30 | 26 / 27 / 27 | 33 / 30 / 33 | 30 / 30 / 30 |
| mastery + timed (informed) | 71 / 69 / 71 | 70 / 72 / 72 | 68 / 67 / 72 | 71 / 74 / 74 | 68 / 69 / 74 |
| mid + timed (informed) | 35 / 35 / 35 | 35 / 35 / 34 | 24 / 24 / 24 | 35 / 36 / 35 | 29 / 26 / 28 |

Wind-ups interrupted / fights where the special fires (boss 25 %): interrupt ON, naive rush 39 % (mastery) and 18 % (mid) / 35 % and 61 %; informed 64 % and 69 % / 23 % and 24 %; interrupt OFF, nothing is interrupted and it fires in 56-74 % of fights for the reacting bots. A player who does not react is hit in 69 % (mastery) and 75 % (mid) of fights.

What it says:
- **Interrupt ON** puts the informed player (reads the tell, times the heavy) at his no-special win: mastery 70 / 72 / 72 against 71 / 69 / 71, mid 35 / 35 / 34 against 35. The cap Strategy set (about +3 over no special) holds, and reading the tell is rewarded without being a free punish.
- **Interrupt OFF**: the informed mid-skill player is 11 points under his no-special win (24 against 35), so reading the tell earns him nothing; the mastery player is about level (68 / 67 / 72). The naive mastery rusher rises above his no-special win (70 / 72 / 75), because the recovery opens a free window he attacks into.
- **Players who do not react** lose 13-15 points (mastery) and 15-16 (mid) to the 25 % special, 9-13 and 12-13 to the 20 % one.
- The 20 % class special with the interrupt leaves informed players at 71-74 (mastery) and 35-36 (mid), at or just inside the ceilings of about 74 / 38 used before.

## How the numbers were reached (history)

1. A first study at 30 % damage, 20 s re-arm, 2 s wind-up, no interrupt: mastery 71 / 69 / 71 fell to 55 / 58 / 59; the special was the killing blow in 14-22 % of losses; the caster died in the wind-up in under 1 % of wind-ups; no rung became unwinnable (worst opponent cell 20-23 %).
2. "Any heavy interrupts": a rushing heavy interrupted 94-99 % of wind-ups, so the special fired in 1-7 % of those fights and the reacting player won more than with no special at all. Dropped.
3. Charged-only and poise 60/40 and 70/30 (the interrupt shapes): neither held an informed player in band while the caster stood idle. Poise 70/30 plus a caster that blocks 30 % of the open window did (informed about +3); 50 % pushed him below his no-special win.
4. The 45-tick recovery, then Dom's corrected numbers (above).

## Caveats

- Damage is taken as a share of the PLAYER's max health (100). Gear and tier are not in the sim (gear stats are parked), so "the hero at a matching tier" is the same unequipped hero.
- The caster idles in the wind-up apart from the modelled blocks. A caster that moves or defends there would be interrupted less than measured.
- The bots are scripts with perfect knowledge of the tell, not people. 30 seeds per opponent gives about ±9 points per opponent cell and about ±3 across ten opponents.
- The plain bots win only by parrying the caster's swings; the 45-tick recovery removes the swings they react to, so it lowers their win while it helps a bot that attacks in the window. A person who attacks in the recovery gains more than the table shows.
- The special is modelled as one instant hit on release; no animation, camera or audio. The class special is a stand-in at ranks 8-10, not run at the ranks where it will actually be used.

## Re-running

Check out `origin/stats/special-balance` @ 272f8e06, then:

```
node --experimental-strip-types scripts/special-balance.ts <opponent> 30 dom 0.3
```
prints one JSON line per opponent (`rank|variant|bot` cells). Run it on the VPS at nice 19 (never on the Mac during a release). Earlier modes in the same file: no argument, `interrupt`, `poise`, `block`, `final`.
