# Pre-beta difficulty curve check (what is live, 2026-10-01)

Stats lane, for Strategy. Read-only measurement of the sim that is LIVE (revision `e2e70ab1`, identical in `src/duel.ts`, `moves.ts`, `ai.ts`, `combat.ts` and `sim.ts` to the trunk tip at the time); no specials (they are not on trunk). Harness: `scripts/special-balance.ts` `curve` mode on branch `stats/special-balance` @ c37528c4 (`node --experimental-strip-types scripts/special-balance.ts <opponent> 30 curve 0.3`, one JSON per opponent; run on the VPS at nice 19).

Method: every ladder level 1-46 against each of the 10 ladder opponents, 30 seeds per opponent and level, two scripted bots from `tests/strategies.ts`: **mastery** = the perfect-parry script and **mid** = perfect parry answering each swing with probability 0.3. Both are parry bots with perfect knowledge of the tell: they read the sim's rules, not a person. A rank is its levels (R1 = 1-5, R2 = 6-10, R3 = 11-15, R4 = 16-20, R5 = 21-25, R6 = 26-30, R7 = 31-35, R8 = 36-40, R9 = 41-45, R10 = 46), so a pooled rank cell is 300 fights per level times its levels (1500 for ranks 1-9, 300 for rank 10) and a per-opponent rank cell is 150 fights (30 at rank 10, a single level).

## The curve, pooled over all ten opponents (win %)

| rank | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 |
|---|---|---|---|---|---|---|---|---|---|---|
| mid-skill | 41 | 32 | 31 | 34 | 33 | 34 | 32 | 35 | 35 | 35 |
| mastery | 87 | 83 | 76 | 75 | 73 | 72 | 71 | 71 | 72 | 71 |
| mean fight, mid-skill (s) | 38 | 31 | 30 | 29 | 28 | 29 | 29 | 28 | 28 | 28 |

Level by level (mid / mastery) the pooled curve has no jump: the largest step between neighbouring levels is 8 points (L5 to L6, both bots, the rank 1 to 2 boundary); the mid-skill bot is 28-37 % on every level from 6 up, and mastery falls from 93 % at level 1 to about 70 % by level 30 and stays there. Pooled, difficulty rises through ranks 1-3 and is flat from rank 4 to the top.

## Where it is not flat: the opponent, not the rank (win %, levels pooled per rank)

mid-skill bot, R1 / R2 / ... / R10:

| opponent | R1-R10 |
|---|---|
| nightborn, plaguedoctor (identical, see below) | 69 63 60 71 70 68 60 68 67 57 |
| goblin | 55 58 60 60 65 63 61 77 67 67 |
| witch | 55 51 53 54 50 55 51 52 51 53 |
| veteran | 49 43 45 39 45 41 49 50 57 50 |
| shieldmaiden | 34 19 16 23 20 21 19 16 18 23 |
| dwarf | 22 7 3 7 3 3 5 5 3 3 |
| executioner | 23 7 5 5 2 5 6 5 5 17 |
| pitborn | 17 7 7 6 3 7 4 5 5 7 |
| knight | 15 3 1 1 3 7 3 4 9 17 |

mastery (perfect parry), R1 / R2 / ... / R10:

| opponent | R1-R10 |
|---|---|
| nightborn, plaguedoctor, witch | 94 100 98 99 99 97 99 100 100 100 (witch 99 97 99 99 99 99 99 98 99 100) |
| veteran | 98 95 95 95 96 95 93 95 90 90 |
| goblin | 76 70 64 69 61 71 57 62 62 53 |
| shieldmaiden | 71 70 77 75 74 79 79 75 85 73 |
| executioner | 98 91 80 75 73 69 61 59 52 50 |
| knight | 93 84 73 69 58 55 54 49 36 43 |
| dwarf | 83 72 49 39 41 38 45 53 57 60 |
| pitborn | 66 49 31 37 31 25 28 23 35 40 |

## Flags

Jumps of more than 10 points between neighbouring ranks for one opponent (150 fights per cell; about ±8 points is noise, rank 10 only 30 fights, ±17):
- mid-skill R1 to R2: dwarf 22 to 7, executioner 23 to 7, knight 15 to 3, shieldmaiden 34 to 19. Rank 1 is the only rank these four are beatable by a parry-reacting player; from rank 2 they are not (1-9 % at every rank after).
- mid-skill: goblin R7 to R8 61 to 77 (+16); nightborn and plaguedoctor R3 to R4 60 to 71 (+11); executioner R9 to R10 5 to 17 and knight R9 to R10 9 to 17 (rank 10 is one level, n=30, so these are within noise).
- mastery: dwarf R2 to R3 72 to 49 (-23, then flat at 38-45 and back up to 60 by R10), pitborn R1 to R2 66 to 49 and R2 to R3 49 to 31 (-35 in two steps, then flat at 23-40), executioner R2 to R3 91 to 80, knight R2 to R3 84 to 73, R4 to R5 69 to 58 and R8 to R9 49 to 36, goblin R6 to R7 71 to 57, shieldmaiden R9 to R10 85 to 73.

Outliers inside a rank (more than 15 points from that rank's mean over the ten opponents), at every rank 2-9 for the mid-skill bot:
- far below the mean: dwarf, executioner, knight, pitborn (1-9 % against a mean of 31-35 %), and shieldmaiden at ranks 8 and 9 (16-18 %).
- far above: goblin (58-77 %), nightborn and plaguedoctor (60-71 %), witch (50-55 %), and veteran at ranks 7 and 9 (49-57 %).
- for mastery the same split: nightborn, plaguedoctor and witch are 97-100 % at every rank and veteran 90-98 %; pitborn (23-49 % from rank 2), dwarf (38-72 %) and knight (36-84 %) sit far below the mean.
- spread inside one rank is therefore 1-77 points for the mid-skill bot and 23-100 for mastery: the ladder's difficulty is mostly set by WHICH opponent comes up, because the next opponent is a random pick from the unbeaten ones, so the same rank can be near-certain or near-impossible for a parry player.

Opponents whose own curve does not ramp (flat or easing with level), so the level scaling adds nothing for them: nightborn, plaguedoctor, witch and veteran (mastery 90-100 % at level 1 and at level 46; nightborn's mid-skill win falls only from 83 % to 57 %), shieldmaiden (mastery 71-85 % at every rank), goblin (mid-skill 55-77 %, rising), and dwarf and pitborn after rank 3 (flat or easing: dwarf mastery 38 % at R6 to 60 % at R10). Opponents that ramp well: executioner (mastery 98 to 50 %) and knight (93 to 36-43 %).

Sim-identical pair: nightborn and plaguedoctor give the same win count in every cell of this study, and a direct 30-fight check at level 20 gives the same fight ticks (50036 for both). They differ in rig, scale and AI lapse, but nothing in the fight changes, so in the sim they are one opponent with two names and two looks.

## Caveats

- The two bots are parry-reaction scripts. Opponents that lean on unparryable or fast attacks (dwarf, executioner, knight, pitborn) are the ones this kind of player cannot answer; a human also blocks, dodges, steps and attacks, so read the per-opponent split as "for a player who answers swings with parries", not as a measure of a person. Mastery (perfect parry) is the better evidence that an opponent is hard on its own (pitborn, dwarf, knight, executioner at the top ranks).
- n = 30 fights per opponent and level; the cells quoted per opponent and rank rest on 150 fights (30 at rank 10) and carry about ±8 points of noise (±17 at rank 10).
- Levels are the career's difficulty level 1-46 (`moves.ts profileAt`), tier-independent: gear and the Pit are not in the sim.
- Nothing here changes the game; no number was tuned.
