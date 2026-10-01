# Boss special: locked balance spec and the evidence for it (2026-10-01)

Stats lane, for Combat to build from. Ruled by Strategy (Dom's numbers plus the rulings below). Nothing in `src/` was changed by this study; the harness is `scripts/special-balance.ts` on branch `stats/special-balance`.

## LOCKED SPEC

| Rule | Value |
|---|---|
| Who | boss rungs, ranks 8-10 (levels 40-46); class moves are a separate 20 % special and were not studied beyond a 20 % sensitivity run |
| Damage | 30 % of the player's max health, unblockable and undodgeable once released |
| First use | 15 s into the fight (900 ticks), once the caster is `ready` |
| Wind-up | 2 s (120 ticks). The caster cannot block or dodge in it and takes normal hits |
| Re-arm | 20 s (1200 ticks) after a release or an interrupt |
| Poise | the first 70 % of the wind-up (84 ticks): the caster cannot be staggered; a hit there cancels nothing (its damage still lands) |
| Open window | the last 30 % (36 ticks): a landed heavy (the HUD heavy class), charged hit or guard break staggers him and cancels the special |
| Block | in the open window the caster blocks 30 % of hits; a blocked blow does nothing (no damage, no stagger, no cancel) and the special goes on |
| Recovery | after the special lands the caster may not start an attack for 45 ticks (today the AI attacks 18 ticks after Blood Tithe lands). Defence and movement stay as the AI decides |
| Tell | the presentation clips are the visible tell |

## Result for the locked spec

n=300 per cell (10 ladder opponents × 30 seeds), ranks 8 / 9 / 10, win %. Bots are the scripts in `tests/strategies.ts` plus: **mid** = perfect parry answering each swing with probability 0.3 (a 35 % base win), **rush** = close and throw a plain heavy in the wind-up (naive), **timed** = close and time the heavy to land once the poise window ends (informed).

| bot | no special | locked, no recovery | locked + 45-tick recovery |
|---|---|---|---|
| mastery (perfect parry), plain | 71 / 69 / 71 | 52 / 52 / 56 | 50 / 51 / 55 |
| mid, plain | 35 / 35 / 35 | 18 / 17 / 16 | 16 / 16 / 14 |
| mastery + rush (naive) | 71 / 69 / 71 | 75 / 74 / 74 | 71 / 71 / 71 |
| mid + rush (naive) | 35 / 35 / 35 | 25 / 25 / 31 | 27 / 28 / 34 |
| mastery + timed (informed) | 71 / 69 / 71 | 70 / 73 / 74 | 72 / 71 / 71 |
| mid + timed (informed) | 35 / 35 / 35 | 34 / 33 / 34 | 34 / 33 / 34 |

Wind-ups interrupted / fights where the special fires (locked + recovery): naive mastery 34 % / 61 %, naive mid 23 % / 75 %, informed mastery 58 % / 41 %, informed mid 63 % / 37 %; a player who does not react is hit in 95 % of fights.
Targets met: the informed player stays within about +3 of his no-special win (mastery 71-72 against 69-71, mid 33-34 against 35); the naive rusher still interrupts 23-34 % of wind-ups; players who do not react take the special in 95 % of fights. Blocks of 35 % and 40 % were also run with recovery and only lower the informed player (mastery 68-70, mid 30-33), so 30 % stands.

## How the spec was reached

1. 30 % damage, 20 s re-arm, 2 s wind-up with no interrupt (Strategy's brief): the mastery bot's win falls 71 / 69 / 71 to 55 / 58 / 59; the special is the killing blow in 14-22 % of losses; the caster dies in the wind-up in under 1 % of wind-ups; no rung becomes unwinnable (worst opponent cell 20-23 %). 20 % damage is only about 5 points gentler.
2. Any heavy interrupts, first use 15 s: a rushing heavy interrupted 94-99 % of wind-ups, so the special fired in 1-7 % of those fights and the reacting player won more than with no special at all (mid 35 to 41-43, mastery 71 to 73-81). Dropped.
3. Charged-only (B) and poise 60/40, 70/30 (A): neither held an informed player in band (92-99 % of wind-ups interrupted once he times the heavy or charges it). A 70/30 was closest.
4. A 70/30 plus a caster that blocks some of the open window: 30 % held the informed player at about +3 (above), 50 % pushed him below his no-special win (mastery 65-69, mid 27-30), so reading the tell earned nothing. 30 % was locked.
5. The 45-tick recovery was then added (above).

## Caveats

- Damage is taken as 30 % of the player's max health (100). Gear and tier are not in the sim (gear stats are parked), so "the hero at a matching tier" is the same unequipped hero.
- The caster idles in the wind-up apart from the modelled blocks. A caster that moves or defends there would be interrupted less than measured.
- The bots are scripts with perfect knowledge of the tell, not people. 30 seeds per opponent gives about ±9 points per opponent cell and about ±3 across ten opponents.
- The plain bots win only by parrying the caster's swings; the 45-tick recovery removes the swings they react to, so it lowers their win (52 to 50, 18 to 16) while it helps a bot that attacks in the window. A person who attacks in the recovery gains more than the table shows.
- The special is modelled as one instant hit on release; no animation, camera or audio.

## Re-running

```
node --experimental-strip-types scripts/special-balance.ts <opponent> 30 final 0.3
```
prints one JSON line per opponent (`rank|variant|bot` cells). Run it on the VPS at nice 19 (never on the Mac during a release). Earlier modes in the same file: no argument (spec and cancel variants), `interrupt`, `poise`, `block`.
