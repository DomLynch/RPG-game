# Origins progression: one career, one pay rule (proposal)

- Author: impl-progression, 2026-10-06, revised the same day to Dom's rising curve, then to Dom's boss ruling and his universal-system
  brief (16:40). For Strategy and Dom. Serves Dom's ruling 7; clean room under ruling 8 (written from this repo and the specs here).
- Status: **proposal**. Nothing here ships or changes `src/`. The executable half is `origins/progression/model.ts`. Every number
  and worked example below is pinned in `origins/progression/model.test.ts` (46 tests, Node's built-in runner; CI runs them through
  `tests/origins-progression.test.ts`).
- Scale: **career level 1 to the ladder cap**, read from `src/career.ts` `MAX_LEVEL`: **46 today, 50 after Dom's 2026-10-05
  ruling** (Origin I–V are levels 46–50; the arena Combat track makes that change, not live yet). The model declares no cap of its
  own and every test runs at both. Headline numbers are at 50. Gladiator I is level 11.

---

## Page one, in plain English

**Rank is one number, career credit, and each level costs more than the last.** Level 1 to 2 costs 1,000 points. The cost rises
gently by 100 a level up to level 10, then climbs faster from Gladiator I (level 11): out of Veteran I 3,400, out of Praetorian I
9,900, out of Origin IV 43,825. Rank, title and every gate read the level that credit buys.

**Everything pays by one rule.** A win is worth a *kill value* for the target's level (never more than yours), times the level
difference, times the **weight of its type**. The kill value is the gentle part of the curve: up to level 10 it is exactly one level;
from Gladiator I the curve pulls away from it, so every single win is a smaller and smaller part of a level as you rise. Nothing in
the pay counts how many bosses or legends exist. **A new kind of content (a minotaur, a dungeon, a raid) is one new row in the
weight table; the curve never changes** (a test adds a minotaur to prove it).

| Type | Weight (part of a kill value) | At level 1 | At 11 | At 30 | At 49 | Rule |
|---|---|---|---|---|---|---|
| Pit legend | 1/10 | 100 | 200 | 390 | 580 | first win only |
| World boss | 1/2 | 500 | 1,000 | 1,950 | 2,900 | first kill only; ≥ 10% of the fight |
| Named / elite / mob | 1/5 · 2/25 · 1/50 | 200 / 80 / 20 | 400 / 160 / 40 | 780 / 312 / 78 | 1,160 / 464 / 116 | from the daily allowance; repeat heat |
| Story step / chapter | 1/10 · 1/2 | 100 / 500 | 200 / 1,000 | 390 / 1,950 | 580 / 2,900 | once ever |
| *(a level costs)* | | *1,000* | *2,025* | *13,900* | *43,825* | |

**Every boss pays once.** A Pit legend or a world boss pays the first time you beat it and never again: a second win says
"already beaten" and pays nothing. There is no lockout any more. **At Origin V every boss reopens**: reaching the top clears the
beaten flags, so every legend and world boss can be fought again (the level cannot move past the top).

**The Pit carries you to Gladiator I, then becomes one part among many.** Today's Pit has ten opponents, each a legend once at each
level. Up to level 10 the ten wins at a level pay exactly that level, so a new player climbs on the Pit alone, as today. At Gladiator I
the ten pay 2,000 of the 2,025 the level needs, and the gap widens every level after: the Pit alone stops at Gladiator I and the rest
comes from the world. **Nobody reaches Origin V on the Pit alone, and no rule says so: it falls out of the weights.** Over a climb
from Gladiator I to Origin V the Pit is about a fifth of the credit.

**Creatures are bounded by an allowance** of up to 3,000 points that refills by 1,500 a day; a bot can never take more. A creature
well beneath you pays nothing, and the same kind over and over pays less after the third.

**What it feels like** (section 2.2): a heavy player (3 h a day) reaches Gladiator I on day 7 and Origin V on day 73; a casual player
(30 min a day) on days 33 and 247. **Decided (Dom, 2026-10-06):** 50 levels; bosses pay once and reopen at Origin V; the Pit alone
carries to Gladiator I; story once; the allowance 1,500 a day holding 3,000. **Still open:** section 9.

---

## 1. The key numbers

| # | Number | Value |
|---|---|---|
| 1 | Requirement to leave level L | **`requirement(L) = 1000 + 100·(L−1) + 25·max(0, L−10)²`** CP (`REQ_BASE`, `REQ_STEP`, `REQ_KNEE`, `REQ_CURVE`) |
| 2 | Kill value at level L | **`killValue(L) = 1000 + 100·(L−1)`**, the curve's linear part: = `requirement(L)` to 10, below it from 11 |
| 3 | The pay rule | **`cp = killValue(min(target, you)) × falloff(target − you) × weight`**; story: `killValue(you) × weight` |
| 4 | Type weights (`TYPE_WEIGHTS`, permille) | **legend 100 · world boss 500 · named 200 · elite 80 · mob 20 · story step 100 · chapter 500** |
| 5 | Once rows (legend, world boss, story) | paid on the first win only, keyed `type:target`; bosses' flags cleared on reaching the cap |
| 6 | Level falloff (d = target − you) | **+3 and up ×1.25 · +1..+2 ×1.10 · 0 ×1 · −1..−2 ×0.90 · −3..−4 ×0.50 · −5 ×0.20 · −6 and below 0** |
| 7 | Repeat heat (creatures) | **per kind: 3 kills full, then ×3/(h+1); one kill's heat cools in 6 minutes; partial heat rounds up** |
| 8 | Rested allowance (creatures only) | **refills 1,500 CP/day, holds 3,000, starts full; empty = 0 CP from creatures** |

CP = career credit points. All integer arithmetic on the server (permille multipliers, one floor at the end). A row carries three
flags besides its weight: `once`, `rested` (allowance and heat) and `party` (`split` EverQuest-style, `each` member their own award
given a 10% share, `solo`).

## 2. The ladder (levels 1–50)

Requirement = CP to go from this level to the next. Cumulative = CP to reach this level from nothing. **Today's ladder stops at 46
(Origin, singular)**; under the 50-level ruling 46–50 are Origin I–V. The curve never reads the cap, so both ladders share every row.

| Level | Title | Requirement | Cumulative | | Level | Title | Requirement | Cumulative |
|---|---|---|---|---|---|---|---|---|
| 1 | Recruit I | 1,000 | 0 | | 26 | Praetorian I | 9,900 | 86,000 |
| 2 | Recruit II | 1,100 | 1,000 | | 27 | Praetorian II | 10,825 | 95,900 |
| 3 | Recruit III | 1,200 | 2,100 | | 28 | Praetorian III | 11,800 | 106,725 |
| 4 | Recruit IV | 1,300 | 3,300 | | 29 | Praetorian IV | 12,825 | 118,525 |
| 5 | Recruit V | 1,400 | 4,600 | | 30 | Praetorian V | 13,900 | 131,350 |
| 6 | Legionary I | 1,500 | 6,000 | | 31 | Master I | 15,025 | 145,250 |
| 7 | Legionary II | 1,600 | 7,500 | | 32 | Master II | 16,200 | 160,275 |
| 8 | Legionary III | 1,700 | 9,100 | | 33 | Master III | 17,425 | 176,475 |
| 9 | Legionary IV | 1,800 | 10,800 | | 34 | Master IV | 18,700 | 193,900 |
| 10 | Legionary V | 1,900 | 12,600 | | 35 | Master V | 20,025 | 212,600 |
| 11 | Gladiator I | 2,025 | 14,500 | | 36 | Primus I | 21,400 | 232,625 |
| 12 | Gladiator II | 2,200 | 16,525 | | 37 | Primus II | 22,825 | 254,025 |
| 13 | Gladiator III | 2,425 | 18,725 | | 38 | Primus III | 24,300 | 276,850 |
| 14 | Gladiator IV | 2,700 | 21,150 | | 39 | Primus IV | 25,825 | 301,150 |
| 15 | Gladiator V | 3,025 | 23,850 | | 40 | Primus V | 27,400 | 326,975 |
| 16 | Veteran I | 3,400 | 26,875 | | 41 | Invictus I | 29,025 | 354,375 |
| 17 | Veteran II | 3,825 | 30,275 | | 42 | Invictus II | 30,700 | 383,400 |
| 18 | Veteran III | 4,300 | 34,100 | | 43 | Invictus III | 32,425 | 414,100 |
| 19 | Veteran IV | 4,825 | 38,400 | | 44 | Invictus IV | 34,200 | 446,525 |
| 20 | Veteran V | 5,400 | 43,225 | | 45 | Invictus V | 36,025 | 480,725 |
| 21 | Champion I | 6,025 | 48,625 | | **46** | **Origin (I)** — top today | 37,900 | **516,750** |
| 22 | Champion II | 6,700 | 54,650 | | 47 | Origin II | 39,825 | 554,650 |
| 23 | Champion III | 7,425 | 61,350 | | 48 | Origin III | 41,800 | 594,475 |
| 24 | Champion IV | 8,200 | 68,775 | | 49 | Origin IV | 43,825 | 636,275 |
| 25 | Champion V | 9,025 | 76,975 | | **50** | **Origin V** — top at cap 50 | 45,900 | **680,100** |

Title = `tierOf(level)` (five sub-ranks a title, Origin from 46), which is the legend rung `src/legends.ts` already shows (pinned).

### 2.1 The Pit's share of each level, Gladiator I to Origin V

"Most the Pit can pay" is all ten of today's opponents beaten at every level of the band; "one win" is a single legend at even level,
first and last level of the band. The two players are section 2.2's.

| Levels | CP to climb the band | Most the Pit can pay | One win, part of a level | Pit share, casual | Pit share, heavy |
|---|---|---|---|---|---|
| 11–15 (Gladiator) | 12,375 | 11,000 (89%) | 9.9% → 7.9% | 28% | 34% |
| 16–20 (Veteran) | 21,750 | 13,500 (62%) | 7.4% → 5.4% | 28% | 29% |
| 21–25 (Champion) | 37,375 | 16,000 (43%) | 5.0% → 3.8% | 27% | 30% |
| 26–30 (Praetorian) | 59,250 | 18,500 (31%) | 3.5% → 2.8% | 25% | 31% |
| 31–35 (Master) | 87,375 | 21,000 (24%) | 2.7% → 2.2% | 23% | 24% |
| 36–40 (Primus) | 121,750 | 23,500 (19%) | 2.1% → 1.8% | 19% | 19% |
| 41–45 (Invictus) | 162,375 | 26,000 (16%) | 1.7% → 1.5% | 16% | 16% |
| 46–49 (Origin I → V) | 163,350 | 22,600 (14%) | 1.5% → 1.3% | 14% | 14% |
| **11–49, total** | **665,600** | **152,100 (23%)** | | **19%** | **20%** |

Below Gladiator I the Pit is 100% of every level (there is nothing else yet). These shares are today's content: more Pit legends
later would raise the most the Pit can pay without touching the weights, which is the dial if Dom wants a bigger or smaller Pit.

### 2.2 Days to Gladiator I and to Origin V

From `playerDays` in `scenarios.ts` (pinned in "worked example D"). "Day N" is the day the level is first reached, day 1 being the
first day of play. Assumptions, all in the scenario:

- **Casual, 30 min a day:** 4 Pit fights, 1 world-boss fight, 12 mobs + 1 elite at their own level, a story step every third day.
- **Heavy, 3 h a day:** 20 Pit fights, 6 world-boss fights, 80 mobs + 10 elites, a story step every day.
- **Today's Pit:** the ten opponents, each a legend once at each level. **"Enough world content":** from Gladiator I a world boss the
  player has not beaten is always there at their own level, fought solo; creatures over 20 mob and 5 elite kinds (never hot); four
  story steps and a chapter per title. Nothing in the world before Gladiator I.
- Win rate for Pit and boss fights: 80% at Recruit, five points lower each title (40% at Invictus, 35% at Origin), dealt out by a
  fixed accumulator, not dice.

| Level | Legionary 6 | **Gladiator I 11** | Veteran 16 | Champion 21 | Praetorian 26 | Master 31 | Primus 36 | Invictus 41 | Origin I 46 | **Origin V 50** |
|---|---|---|---|---|---|---|---|---|---|---|
| Casual | day 16 | **33** | 38 | 47 | 60 | 79 | 105 | 142 | 193 | **247** |
| Heavy | day 4 | **7** | 8 | 10 | 13 | 18 | 26 | 38 | 55 | **73** |

Where the credit came from on the way to Origin V: casual creatures 43.7%, world bosses 32.0%, Pit 20.8%, story 3.4%; heavy world
bosses 60.0%, Pit 21.7%, creatures 15.0%, story 3.3%. The casual player beats 97 world bosses on the way, the heavy one 178: "enough world content" means a fresh boss at every level for those players, which is a content target, not a rule here.
**Read this honestly:** the days to Gladiator I are now set by the Pit at a tenth of a level a win (100 wins), slower than today's
"one win, one level" (casual day 5 under the old rule); a legend at a fifth would halve them but let the Pit alone carry to level 22.

## 3. The career number, the Pit, bosses and the migration

- **State.** `credit` (CP, integer, never decreases), `beaten` (the once-rows already paid, `type:target`), `story` (step ids), the
  allowance, heat rows and `pit.rung`. Rank, title, sub-rank and gates read `levelOfCredit(credit, cap)`, the highest level whose
  cumulative is ≤ credit, never above the cap. `pitWins` is a count for the Pit board only.
- **The Pit.** A Pit fight is at your own level (the live dial). The next opponent is `nextLegend(state, opponents, key)`: one not yet
  beaten at your level, chosen by a key (a hash of profile and wins, as `src/ladder.ts` picks today, so the HUD and the Next button
  agree). A win pays the legend row and retires that opponent at that level (`legend:opponent@level`); a second win pays 0
  (`already-beaten`). When all ten are beaten the Pit waits for the world to raise you. `pit.rung` records the level the Pit last
  fought at; **it is never above the career level** (property-tested).
- **World bosses** pay their first kill only (`already-beaten` after), each eligible member their own award; a grey kill or a share
  under 10% pays 0 and does not use the boss up. **The 7-day lockout is gone.**
- **Origin V reopens every boss.** On reaching the cap the beaten flags are cleared, and none is kept while there (`allBossesOpen`):
  every legend and world boss can be fought again; credit still counts but the level cannot move. Story is once ever, never reopened.
- **Legends beaten once is a POST-BETA proposal for the arena Lead.** Today the live ladder re-offers opponents.
- **Migration, exact.** `credit := cumulative(levelOfMarks(marks))`, where `levelOfMarks` is today's `levelOf` (`min(cap, 1 +
  marks)`) and marks are the server figure (`account_seed.marks` + verified claims, as `standing_of()` computes). `pit.rung := that
  same level`; **nothing beaten**; `pitWins := marks`; the allowance starts full. Pinned for marks 0–120 against the real `levelOf`,
  at caps 46 and 50: **every live player keeps their exact level.**
- **The rank bar gets its fill back.** `Rank.fill` (0 today) becomes `fillPermille`: the part of the current level earned.
- **Monotonic.** No rule subtracts credit. Property test: 20 random streams × 1,500 mixed events with retries and out-of-order
  times, at both caps: credit, level and every award non-decreasing / non-negative, nothing paid twice, flags empty at the cap.

## 4. Formulas

Multipliers are permille (1000 = ×1). `L` = the level from credit **before** the event. Server time in whole seconds; a time earlier
than a stored clock counts as zero elapsed.

### 4.1 Every kill
```
row      = TYPE_WEIGHTS[type]                              // own key only; an unknown type is refused
you      = L, or for a 'split' row the highest member's level (the highest member sets the colour)
cp       = floor(killValue(min(target, you)) × falloff(target − you) × row.weight / 10^6)
once     : already in beaten → 0 'already-beaten'; paid → beaten += type:target
each     : partyEligible(L, highest) and contribution ≥ 100‰, else 0
split    : × partyShare(n); members must be present and inside the level gap
rested   : × repeat(h);  cp = min(cp, allowance);  allowance −= cp;  heat[target kind] += 360 (paid or not)
```
A grey kill (6+ below) pays 0 and does not use a boss up. A Pit win is the `legend` row at your own level, keyed by opponent and
level. Story is `killValue(L) × weight`, once per step id.

### 4.2 Repeat heat
Per kind: `units` (seconds) and `at`. Before a kill, `units` drains one per second; `h = ceil(units / 360)`, so **partial heat
rounds up**: a kill whose heat has not fully cooled still counts as a whole kill. `repeat(h) = 1000` if `h < 3`, else
`floor(3000 / (h + 1))`: h 3 → 750, 5 → 500, 9 → 300, 29 → 100. Kills six minutes apart never heat.

### 4.3 Party share and level gap
`partyShare(n)` for n = 1..4: **1000, 800, 566, 450**; more than four is refused, and a solo row refuses a party.
`partyEligible(Lm, H) = H − Lm ≤ max(5, floor(Lm / 2))`: a 20 with a 30 is eligible, a 19 is not; a level 50 carries nobody below 34.

### 4.4 Rested allowance
`restedUnits` = CP × 86,400 so the refill is exact; refill `(now − restedAt) × 1500`, capped at 3,000 × 86,400. Fixed in CP at every
level, so a day's allowance is a shrinking part of a level.

### 4.5 Idempotency and hostile input
Every event carries a server id (`fight_hash` for Pit wins, an encounter id per character for world kills, the step id for story);
one settlement per id is the server's unique index, modelled by `settleAll`. Every key from an event (type, creature kind, boss id)
is read as an own key or a list entry: a name such as `toString`, `constructor` or `__proto__` is **a plain key or a refusal, never
NaN** (the review's repro, creature kind `toString`, pays 40 and keeps level 11). Anything non-finite, negative or fractional is
refused with the state untouched.

## 5. Anti-farm and bot resistance

| Lever | What it stops | Evidence |
|---|---|---|
| Grey band (6+ below = 0) | High levels farming starter zones | B1: an hour of level-11 hounds at level 30 = 0 CP |
| Highest member's colour + level gap | Carries | C: an Origin carry makes the others ineligible and earns 0 |
| Repeat heat per kind | Camping one spawn | B2: an hour of one level-25 kind at level 30 = 121 CP |
| Rested allowance | Any 24/7 farm | Property: creature credit in any span ≤ pool at its start + the refill over it |
| Kill value behind the curve | Any single source as a road to the top | every row's share of a level falls every level from 11 (tested) |
| First win only + contribution | Boss farming, leeching, Pit re-farming | a second win = 0; < 10% of the fight = 0 |
| Story once, unknown types refused | A content typo minting a rank | refused |

## 6. Server-verification points

The browser never reports a kill. The world server settles world awards; the VPS verifier keeps settling Pit wins.

| Event | The server must see | Where it comes from |
|---|---|---|
| Pit win | Claim and record; replay says `killed`; the opponent at your level is unbeaten; `fight_hash` unseen | `scripts/verify-loot.mjs`, `src/awards.ts` |
| Creature kill | Encounter id; type, definition and level from server content; party roster with levels at engage and `present`; server time | World server encounter result |
| Boss kill | As a creature, plus each member's contribution share and the beaten row | World server |
| Story step | The committed quest transition; step id unseen for this character | Story service |
| Any award | The state before; one atomic write of the new state, the award row and the event id | One transaction, as `verify-loot` does today |

Durable state per character: `credit bigint`, `pit_rung int`, beaten rows (`type:target`, cleared at the cap), `pit_wins int`,
`rested_units bigint`, `rested_at`, heat rows (prunable once cooled), story step ids, the award log keyed by event id. The type-weight
table is server content, versioned with the rest. Clients never write any of it.

## 7. Worked examples (pinned in model.test.ts)

Region 1 names and levels are placeholders for the region-1 content lane.

### A. A Gladiator I clears region 1 and chapter one in an evening (`regionClear`, about 2 h 35 min)
Level 11 (credit 14,500), full allowance. 48 mobs (levels 11–14), 12 court sentinels (15, elite), 2 vampire reeves (16, named), three
bosses, four story steps and the chapter.

| Source | CP |
|---|---|
| Toll-Keeper (13) at level 11 / Steward of Ash (15) at 12 / Count of the Ruin (16) at 13 | 1,100 / 1,312 / 1,375 = **3,787** |
| Story (4 steps + the chapter) | 1,980 |
| Mobs (48) | 1,361 (ash hounds 288: kills 75 s apart heat the kind) |
| Elites (12) / named (2) | 1,757 / 16 (the allowance ran dry) |
| **Total** | **8,901 → credit 23,401, level 14 (Gladiator IV)** |

Allowance left: 26. The Pit waits at Gladiator I: ten fresh legends at level 14 are worth 2,300, about a quarter of the evening.

### B. A level-30 (Praetorian V, requirement 13,900, kill value 3,900) farming low creatures
- **B1:** an hour of level-11 ash hounds, one every 30 s: **0 CP** (grey). The kind still heats.
- **B2:** an hour of one level-25 kind, one every 30 s: **121 CP**, under 1% of a level. Per kill 13, 13, 13, 9, 7, 6, 5, 4, then less.
- **B3, a 24-hour bot on even-level mobs** (20 kinds, a kill every 15 s): **4,499 CP**, a third of a level: 3,062 in hour one (the
  full allowance), then 62–63 an hour (the refill).
- **B4, the same bot for a week: 10,161 CP**, under one level: the allowance, not the kill pay, is the ceiling.

### C. A party of four kills a boss
Levels 14, 15, 16 and 20; the Count of the Ruin is level 16; shares 30%, 25%, 35%, 10%. Each eligible member gets their own award.

| Member | Gap to highest (20) | Boss d | CP |
|---|---|---|---|
| 14 | 6 ≤ 7, eligible | +2 | 1,265 = killValue(14) × 1.1 / 2 |
| 15 | 5, eligible | +1 | 1,320 |
| 16 | 4, eligible | 0 | 1,250 |
| 20 | 0 | −4 | 625 = killValue(16) × 0.5 / 2 |

- Swap the 14 for a level-46 Origin: the 15, 16 and 20 are ineligible and the Origin's boss is grey. **Everyone gets 0.**
- Their elite kills (court sentinel, 15): with the level 20 present the colour is his (×0.2) and the share 450‰: **17 CP each**;
  without him **97**; solo at 15 **192**.
- The same Count again, for anyone who was paid: **0, already beaten**, until Origin V.

## 8. What each donor contributes, and what we leave out

## 8. What each donor contributes, and what we leave out

| Donor | Taken | Left out, and why |
|---|---|---|
| **EverQuest** (eqemu-experience.md) | A requirement that grows with level (§5.6), in our own shape (linear, then a square term from Gladiator), not the cubic table; consider-colour falloff (§5.2) as six bands; grey = 0 (§6); the highest member sets the colour (§7); group pool `X(1 + g/2)/n` (§5.4); level-gap eligibility (§5.4); a per-kill cap (§5.3); "a percentage of a level" for fixed rewards (§5.9) → every row is a fixed part of a kill value | The cubic table itself and ExpMultiplier 0.5; death XP loss (§5.8); AA; hot zones; race/class bonuses; the `(L+3)²` per-member cap; top-damage-gets-the-kill (§6) |
| **Ultima Online** (modernuo-skill-stat-gain.md, -virtues.md, -champion-spawns.md) | Uncertain outcomes teach more (§4.2) → harder creatures pay more; the anti-macro key, allowance 3 with expiry (§4.3) → repeat heat; the champion kill bar (§4.3) as a public-event shape | Skill gain by use, the total cap and atrophy (§4.6); stat gain (§4.8–4.9); virtue decay |
| **World of Warcraft** (published design, not a spec) | A per-level requirement that rises, so low content shrinks as you grow; the rested pool, turned into the ceiling on creature credit; quests and bosses as the main world source; the world as the main road after the starting zone; grey gives nothing | Rested as a double-XP bonus (leaves bots unbounded) |
| **Morrowind** (openmw-levelling-skills.md) | Overflow carries into the next level (§4.7) → the rank bar fills; levelling settled at a safe point (§4.5) → awards settle on the server | Skill-use progression, attribute multipliers (§4.2–4.6); trainers for gold (§4.9); jail skill loss (§4.10) |
| **Gothic II** (gothic-progression.md) | `level / exp / exp_next` as a stored model (§4) → one stored credit, level derived; mentors (§1, §8) → techniques gated by level | Talents that change hit chance or damage (§5.4); the retail XP curve |

## 9. Decisions

**Decided (Dom, 2026-10-06):**
1. **50 levels**, Origin I–V at 46–50, the cap read from `src/career.ts`.
2. **Bosses pay once**, Pit legend or world boss; no rematch credit, no lockout; **Origin V reopens every boss**.
3. **A universal pay rule**: kill value × falloff × type weight; content plugs in as a row; nothing counts bosses.
4. **The Pit alone carries to Gladiator I** and its share shrinks after, by the weights, not by a cap.
5. **Story** once ever; **allowance** 1,500 CP a day, holding 3,000, fixed in CP.

**Open, for Strategy and Dom:**
6. **The legend weight.** 1/10 of a kill value makes today's ten opponents a level exactly carry to Gladiator I (casual day 33, heavy
   day 7). The suggested 1/5 halves that (casual day 17, heavy day 4) but lets the Pit alone carry to level 22. One number, no curve
   change.
7. **What counts as one legend.** The model keys a legend by opponent and level (ten a level, the live dial). If a legend is one per
   title (the 100 faces in `src/legends.ts`), the Pit alone stalls at level 2 and the legend weight would need to be 1/2.
8. **Legends beaten once** (POST-BETA, arena Lead): ship with the Pit, or keep re-offering opponents.
9. **World content volume.** The days in 2.2 assume a fresh world boss is always there; the players beat 97 (casual) and 178
   (heavy) on the way to Origin V, about 2.5 and 4.5 a level.

## 10. Deliberate divergences from the donor specs

1. **Our own rising curve** (linear to 10, a square term from 11) and **one kill value** (its linear part) for every type, instead
   of EverQuest's cubic table and per-source formulas.
2. **No ExpMultiplier** or FinalExpMultiplier; weights are set directly in one table.
3. **Falloff by level difference only**, the same at every level and both caps (tested 1–50 × −12..+12 for every row).
4. **Above-level bonus capped at ×1.25** on the value at your own level; **grey at d ≤ −6** at every level.
5. **Bosses not split**; party size 1–4; a 10% contribution threshold instead of top damage takes the kill.
6. **First win only, reopened at the top**: no donor has it; it replaces both the lockout and rematch credit.
7. **Repeat heat keyed on creature kind**, charged on unpaid kills too, rounding partial heat up.
8. **Rested allowance is a ceiling, not a bonus**, fixed in CP while the requirement rises.
9. **No death penalty, no decay, no skill or stat gain by use, no level-up ceremony**; **credit counts past the cap**; **integer
   permille** maths.

## 11. Files

- `origins/progression/model.ts`: the pure reference model (`requirement`, `killValue`, `cumulative`, `levelOfCredit`,
  `creditFromMarks`, `fillPermille`, `tierOf`, `TYPE_WEIGHTS`, `basePay`, `nextLegend`, `allBossesOpen`, `award`, `settleAll`). Its
  only import is `MAX_LEVEL` and `RANK_STEPS` from `src/career.ts`; integer-only, no clock or randomness. `award` and `settleAll`
  take an optional type table, so new content is tested without editing the model.
- `origins/progression/scenarios.ts`: the worked examples and the two players of section 2.2.
- `origins/progression/model.test.ts`: 46 tests (`node:test`); `tests/origins-progression.test.ts` imports it so `npm test` runs them.
