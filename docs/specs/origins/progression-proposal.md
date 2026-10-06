# Origins progression: one career, two places to earn it (proposal)

- Author: impl-progression, 2026-10-06, revised the same day to Dom's rising curve and the Pit's own ladder. For Strategy and Dom.
  Serves Dom's ruling 7; clean room under ruling 8 (written from this repo and the specs in this folder only).
- Status: **proposal**. Nothing here ships or changes `src/`. The executable half is `origins/progression/model.ts`. Every number
  and worked example below is pinned in `origins/progression/model.test.ts` (45 tests, Node's built-in runner; CI runs them through
  `tests/origins-progression.test.ts`).
- Scale: **career level 1 to the ladder cap**, read from `src/career.ts` `MAX_LEVEL`: **46 today, 50 after Dom's 2026-10-05
  ruling** (the top rank becomes Origin I–V; the arena Combat track makes that change, not live yet). The model declares no cap of
  its own and every test runs at both. Gladiator I is level 11; "Gladiator = rank 3" in the rulings is the title tier, not the level.

---

## Page one, in plain English

**Rank is one number, career credit, and each level costs a bit more than the last.** Level 1 to 2 costs 1,000 points. The cost
rises gently by 100 a level up to level 10, then climbs faster from Gladiator I (level 11): the step out of Veteran I costs 3,400,
out of Praetorian I 9,900, out of Invictus V 36,025. Rank, title and every gate read the level that credit buys.

**The Pit is its own ladder, and you pick it up where you left it.** The Pit remembers its own rung. A Pit win always pays exactly
one level *at your Pit rung* and moves the rung up one. Your opponent is a legend of that rung's title you have not beaten yet; lose,
and you fight the same legend again. A Pit-only player therefore levels exactly as today: one win, one level. A player who also
levels in the world keeps a higher rank, and the Pit simply carries on from where they left it.

**The world pays into the same number:**

| You do this | You get | Limit |
|---|---|---|
| Win a Pit fight | **one level at your Pit rung** | each legend once; losses are retries |
| Kill a world boss | **about one of your levels, never more** (the boss's level, if it is below yours, with the falloff) | each boss once every 7 days; you must have done at least a tenth of the work |
| Finish a story step / chapter | 100 a step, 500 for the chapter | once ever |
| Kill an ordinary / elite / named creature | 20 / 80 / 200 | creature allowance, below |

**Creatures are small change, and get smaller as you rise.** A creature well beneath you pays nothing. Killing the same kind over and
over pays less after the third. All creature credit comes out of an allowance of up to 3,000 points that refills by 1,500 a day; a
bot can never take more than that. At level 11 a full day's allowance is three-quarters of a level; at level 30 it is a ninth.

**What it feels like.** A new Gladiator who plays the first region and chapter one in an evening goes from level 11 to 15, mostly
from the three bosses. A level 30 farming starter creatures gets nothing. A 24-hour bot at level 30 gets a third of one level. Over a
whole climb to Origin, Pit wins are about 90% of the credit, bosses about 8%, creatures under 2%.

**Decided (Dom, 2026-10-06):** story pays 100 a step and 500 a chapter, once; the allowance is 1,500 a day, holding 3,000; a boss
locks for 7 days. **Still open:** section 9.

---

## 1. The key numbers

| # | Number | Value |
|---|---|---|
| 1 | Requirement to leave level L | **`requirement(L) = 1000 + 100·(L−1) + 25·max(0, L−10)²`** CP (`REQ_BASE`, `REQ_STEP`, `REQ_KNEE`, `REQ_CURVE`) |
| 2 | Pit win | **`requirement(rung)`**: one level at the Pit rung; rung + 1; that legend retired |
| 3 | World boss | **`requirement(min(bossLevel, L)) × min(1, falloff)`**; once per boss per rolling 7 days; ≥ 10% contribution |
| 4 | Story | **100 a step, 500 a chapter**, once per step id; any step above 1,000 (`STORY_MAX_CP`) is refused |
| 5 | Mob base | **ordinary 20, elite 80, named 200 CP**; no single non-boss kill above 250 |
| 6 | Level falloff (d = mob − you) | **+3 and up ×1.25 · +1..+2 ×1.10 · 0 ×1 · −1..−2 ×0.90 · −3..−4 ×0.50 · −5 ×0.20 · −6 and below 0** |
| 7 | Repeat heat | **per mob kind: 3 kills full, then ×3/(h+1); one kill's heat cools in 6 minutes; partial heat rounds up** |
| 8 | Rested allowance (mobs only) | **refills 1,500 CP/day, holds 3,000, starts full; empty = 0 CP from mobs** |

CP = career credit points. All integer arithmetic on the server (permille multipliers, one floor at the end).

## 2. The ladder (levels 1–50)

Requirement = CP to go from this level to the next. Cumulative = CP to reach this level from nothing. **Today's ladder stops at 46
(Origin, singular)**: the rows above 46 exist only under the 50-level ruling, where 46–50 are Origin I–V. The curve never reads the
cap, so both ladders share every row.

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

Title = `tierOf(level)` (five sub-ranks a title, Origin from 46), which is the legend rung `src/legends.ts` already shows (pinned). At
the top level the requirement is only what a further Pit win or boss pays; the level does not move.

### 2.1 Days to each title

From `playerDays` in `scenarios.ts` (pinned in "worked example D"). "Day N" is the day the title is first reached, day 1 being the
first day of play. Assumptions, all in the scenario:

- **Casual, 30 min a day:** 3 Pit fights, 12 ordinary + 1 elite creature at their own level, one boss a week, a story step every
  third day.
- **Heavy, 3 h a day:** 20 Pit fights, 80 ordinary + 10 elite creatures, three bosses a week, a story step every day.
- Both: Pit win rate 80% at Recruit, five points lower each title (40% at Invictus, 35% at Origin), dealt out by a fixed
  accumulator, not dice; creatures spread over 20 ordinary and 5 elite kinds (never hot); bosses at their own level, 30% share;
  story 4 steps × 100 + the chapter 500 per title.

| Title (level) | Legionary (6) | Gladiator (11) | Veteran (16) | Champion (21) | Praetorian (26) | Master (31) | Primus (36) | Invictus (41) | Origin (46) | Origin V (50) |
|---|---|---|---|---|---|---|---|---|---|---|
| Casual | day 3 | 5 | 7 | 9 | 12 | 15 | 18 | 22 | **26** | 29 |
| Heavy | day 1 | 1 | 1 | 2 | 2 | 3 | 3 | 4 | **4** | 5 |

Where the credit came from on the way to 46: casual Pit 90.4%, bosses 7.9%, creatures 1.6%, story 0.2%; heavy Pit 90.0%, bosses
8.7%, creatures 1.3%, story 0.1%. **Read this honestly:** because a Pit win is always one level, these days are set by Pit wins and
win rate, not by the curve. The curve does not slow a Pit player; it decides how much the world is worth against a level, and makes
creatures shrink as you rise. If Dom wants Origin to take longer than four heavy days, that is a Pit pacing question (section 9).

## 3. The career number, the Pit ladder and the migration

- **State.** `credit` (CP, integer, never decreases) and the Pit's own `pit = { rung, beaten }`. Rank, title, sub-rank and gates read
  `levelOfCredit(credit, cap)`, the highest level whose cumulative is ≤ credit, never above the cap. `pitWins` is a count for the Pit
  board only.
- **The Pit ladder.** The next opponent is `nextLegend(pit, opponents, key)`: an unbeaten legend of the rung's title, chosen by a key
  (a hash of profile and wins, as `src/ladder.ts` picks today, so the HUD and the Next button agree). A win pays `requirement(rung)`,
  moves the rung up one and retires that legend (`opponent@tier`); the same opponent at another title is a different legend. A
  second win over a retired legend pays nothing. At the top rung the opponents are mass-produced: a win still pays
  `requirement(cap)`, retires nothing, and the level stays at the cap. Pit credit alone reaches exactly the rung's level, so **the
  career level is never below the Pit rung** (property-tested). One win per rung means five legends per title and 45 named fights
  to Origin (49 at cap 50, where Origin I–V are legends too).
- **Legends beaten once is a POST-BETA proposal for the arena Lead.** Today the live ladder re-offers opponents; retiring a legend
  changes the live arena, so it waits for the arena Lead after the beta.
- **Migration, exact.** `credit := cumulative(levelOfMarks(marks))`, where `levelOfMarks` is today's `levelOf` (`min(cap, 1 +
  marks)`) and marks are the server figure (`account_seed.marks` + verified claims, as `standing_of()` computes). `pit.rung := that
  same level`; **no legend beaten** (there is no beaten-once record to carry); `pitWins := marks`, kept for the board; the allowance
  starts full. Pinned for marks 0–120 against the real `levelOf`, at caps 46 and 50: **every live player keeps their exact level.**
- **The rank bar gets its fill back.** `Rank.fill` (0 today) becomes `fillPermille`: the part of the current level's requirement
  earned. Empty at the top.
- **Monotonic.** No rule subtracts credit. Property test: 20 random streams × 1,500 mixed events with retries and out-of-order
  times, at both caps: credit, level and every award non-decreasing / non-negative, no legend beaten twice.

## 4. Formulas

Multipliers are permille (1000 = ×1). `L` = the level from credit **before** the event. Server time in whole seconds; a time earlier
than a stored clock counts as zero elapsed.

### 4.1 World boss
```
eligible = partyEligible(L, highest level in party) and contribution ≥ 100‰ and no credited kill of this boss in the last 7 × 86,400 s
cp       = floor(requirement(min(bossLevel, L)) × min(1000, falloff(bossLevel − L)) / 1000)
```
Each eligible member gets their own award (not split). An even-level or higher boss pays exactly one of your levels; never more. A
grey boss pays 0 and does not start the lockout.

### 4.2 Creatures
```
H    = max(L, other members' levels)                              // the highest member sets the colour
raw  = min(250, floor(base[class] × falloff(mobLevel − H) × partyShare(n) × repeat(h) / 10^9))
cp   = min(raw, floor(restedUnits / 86,400));   restedUnits −= cp × 86,400;   heat[mobKind] += 360 (paid or not)
```
Party members must be present and inside the level gap. The mob **kind**, not the spawn, is the repeat key.

### 4.3 Repeat heat
Per kind: `units` (seconds) and `at`. Before a kill, `units` drains one per second; `h = ceil(units / 360)`, so **partial heat
rounds up**: a kill whose heat has not fully cooled still counts as a whole kill. `repeat(h) = 1000` if `h < 3`, else
`floor(3000 / (h + 1))`: h 3 → 750, 5 → 500, 9 → 300, 29 → 100. The first three kills of a kind always pay in full; the fourth is
reduced whenever the kills came less than two minutes apart on average (four inside six minutes). Kills six minutes apart never heat.

### 4.4 Party share and level gap
`partyShare(n)` for n = 1..4: **1000, 800, 566, 450**; more than four is refused. `partyEligible(Lm, H) = H − Lm ≤ max(5,
floor(Lm / 2))`: a 20 with a 30 is eligible, a 19 is not; a level 50 carries nobody below 34.

### 4.5 Rested allowance and story
`restedUnits` = CP × 86,400 so the refill is exact; refill `(now − restedAt) × 1500`, capped at 3,000 × 86,400. Fixed in CP at every
level, so a day's allowance is a shrinking part of a level. Story `cp` comes from content, 0..1,000 per step, paid once per step id.

### 4.6 Idempotency and hostile input
Every event carries a server id (`fight_hash` for Pit wins, an encounter id per character for world kills, the step id for story);
one settlement per id is the server's unique index, modelled by `settleAll`. Every key that comes from an event (mob kind, boss id,
mob class) is read as an own key only: a name such as `toString`, `constructor` or `__proto__` is **a plain key or a refusal, never
NaN** (the review's repro, mob kind `toString`, now pays 20 and keeps level 11). Anything non-finite, negative or fractional is
refused with the state untouched.

## 5. Anti-farm and bot resistance

| Lever | What it stops | Evidence |
|---|---|---|
| Grey band (6+ below = 0) | High levels farming starter zones | B1: an hour of level-11 hounds at level 30 = 0 CP |
| Highest member's colour + level gap | Carries | C: an Origin carry makes the others ineligible and earns 0 |
| Repeat heat per kind | Camping one spawn | B2: an hour of one level-25 kind at level 30 = 26 CP |
| Rested allowance | Any 24/7 farm | Property: mob credit in any span ≤ pool at its start + the refill over it |
| Rising curve | Creatures as a path to rank | The fixed allowance is ¾ of a level at 11, ⅑ at 30, under ⅒ at 46 |
| Boss lockout + contribution | Boss farming, leeching | 7-day rolling lockout per boss; < 10% contribution = 0 |
| Legends once, Pit rung | Re-farming an easy legend | A second win over a retired legend = 0 |
| Per-kill cap 250, story cap 1,000 | A content typo minting a rank | refused or capped |

## 6. Server-verification points

The browser never reports a kill. The world server settles world awards; the VPS verifier keeps settling Pit wins.

| Event | The server must see | Where it comes from |
|---|---|---|
| Pit win | Claim and record; replay says `killed`; the opponent is the rung's legend and unbeaten; `fight_hash` unseen | `scripts/verify-loot.mjs`, `src/awards.ts` |
| Mob kill | Encounter id; mob definition, class and level from server content; party roster with levels at engage and `present`; server time | World server encounter result |
| Boss kill | As a mob, plus each member's contribution share and the lockout row | World server + `boss_lockouts` |
| Story step | The committed quest transition; step id unseen for this character | Story service |
| Any award | The state before; one atomic write of the new state, the award row and the event id | One transaction, as `verify-loot` does today |

Durable state per character: `credit bigint`, `pit_rung int`, beaten-legend rows, `pit_wins int`, `rested_units bigint`,
`rested_at`, heat rows (prunable once cooled), lockout rows, story step ids, the award log keyed by event id. Clients never write it.

## 7. Worked examples (pinned in model.test.ts)

Region 1 names and levels are placeholders for the region-1 content lane.

### A. A Gladiator I clears region 1 and chapter one in an evening (`regionClear`, about 2 h 35 min)
Level 11 (10 Pit wins, credit 14,500), full allowance. 48 ordinary creatures (levels 11–14), 12 court sentinels (15, elite), 2 vampire
reeves (16, named), three bosses, four stages and the chapter.

| Source | CP |
|---|---|
| Toll-Keeper (13) at level 11 / Steward of Ash (15) at 12 / Count of the Ruin (16) at 14 | 2,025 / 2,200 / 2,700 = **6,925** |
| Story (4 × 100 + 500) | 900 |
| Ordinary (48) | 655 (ash hounds 142 of a possible 240: kills 75 s apart heat the kind) |
| Elites (12) / named (2) | 1,005 / 500 |
| **Total** | **9,985 → credit 24,485, level 15 (Gladiator V)** |

Each boss paid exactly one of the player's levels at the time. Creatures are 2,160 of 9,985 (22%). Allowance left: 1,000. The Pit
waits at rung 11: his next Pit win pays 2,025 (a Gladiator I level) against a Gladiator legend.

### B. A level-30 (Praetorian V, requirement 13,900) farming low creatures
- **B1:** an hour of level-11 ash hounds, one every 30 s: **0 CP** (grey). The kind still heats.
- **B2:** an hour of one level-25 kind, one every 30 s: **26 CP**, 0.2% of a level. Per kill 4, 4, 4, 3, 2, 2, 1, 1, then 1s and 0s.
- **B3, a 24-hour bot on even-level mobs** (20 kinds, a kill every 15 s): **4,499 CP**, a third of a level: 3,062 in hour one (the
  full allowance), then 62–63 an hour (the refill).
- **B4, the same bot for a week: 4,848 CP**, still a third of one level: 349 on day two, then nothing, because its kinds never cool.

### C. A party of four kills a boss
Levels 14, 15, 16 and 20; the Count of the Ruin is level 16; shares 30%, 25%, 35%, 10%.

| Member | Gap to highest (20) | Boss d | CP |
|---|---|---|---|
| 14 | 6 ≤ 7, eligible | +2 | 2,700 = requirement(14) |
| 15 | 5, eligible | +1 | 3,025 = requirement(15) |
| 16 | 4, eligible | 0 | 3,400 = requirement(16) |
| 20 | 0 | −4 | 1,700 = requirement(16) × 0.5 |

- Swap the 14 for a level-46 Origin: the 15, 16 and 20 are ineligible and the Origin's boss is grey. **Everyone gets 0.**
- Their elite kills (court sentinel, 15): with the level 20 present the colour is his (×0.2) and the share 450‰: **7 CP each**;
  without him **40**; solo at 15 **80**.
- Lockout: a level 16 who kills the Count alone gets 3,400; again 7 days less a second later, 0; at exactly 7 days, 3,060 (he is now
  17, so the boss is one below him: requirement(16) × 0.9).

## 8. What each donor contributes, and what we leave out

| Donor | Taken | Left out, and why |
|---|---|---|
| **EverQuest** (eqemu-experience.md) | A requirement that grows with level (§5.6), in our own shape (linear, then a square term from Gladiator), not the cubic table; consider-colour falloff (§5.2) as six bands; grey = 0 (§6); the highest member sets the colour (§7); group pool `X(1 + g/2)/n` (§5.4); level-gap eligibility (§5.4); a per-kill cap (§5.3); "a percentage of a level" for fixed rewards (§5.9) → bosses and Pit wins pay a level | The cubic table itself and ExpMultiplier 0.5; death XP loss (§5.8); AA; hot zones; race/class bonuses; the `(L+3)²` per-member cap; top-damage-gets-the-kill (§6) |
| **Ultima Online** (modernuo-skill-stat-gain.md, -virtues.md, -champion-spawns.md) | Uncertain outcomes teach more (§4.2) → harder creatures pay more; the anti-macro key, allowance 3 with expiry (§4.3) → repeat heat; rolling per-deed windows (virtues §4.2, §4.4) → the 7-day boss lockout; the champion kill bar (§4.3) as a public-event shape | Skill gain by use, the total cap and atrophy (§4.6); stat gain (§4.8–4.9); virtue decay |
| **World of Warcraft** (published design, not a spec) | A per-level requirement that rises, so low content shrinks as you grow; the rested pool, turned into the ceiling on creature credit; quests and bosses as the main world source; grey gives nothing | Rested as a double-XP bonus (leaves bots unbounded) |
| **Morrowind** (openmw-levelling-skills.md) | Overflow carries into the next level (§4.7) → the rank bar fills; levelling settled at a safe point (§4.5) → awards settle on the server | Skill-use progression, attribute multipliers (§4.2–4.6); trainers for gold (§4.9); jail skill loss (§4.10) |
| **Gothic II** (gothic-progression.md) | `level / exp / exp_next` as a stored model (§4) → one stored credit, level derived; mentors (§1, §8) → techniques gated by level | Talents that change hit chance or damage (§5.4); the retail XP curve |

## 9. Decisions

**Decided YES (Dom, 2026-10-06):**
1. **Story credit:** 100 a step, 500 a chapter, once ever; bounded at 1,000 a step (`STORY_MAX_CP`).
2. **Allowance:** 1,500 CP a day, holding 3,000, fixed in CP at every level.
3. **Boss lockout:** 7 days, rolling, per boss per character.

**Open, for Strategy and Dom:**
4. **Legends beaten once** (POST-BETA, arena Lead): ship with the Pit ladder, or keep re-offering opponents and drop the retire step.
5. **Pit pacing.** The curve does not slow a Pit player: a heavy player still reaches Origin on day 4 (section 2.1), as today. If
   that is too fast, the lever is in the Pit (wins per rung, or the win rate), not in this curve.
6. **Pit difficulty.** The Pit opponent comes from the rung; the dial and `levelRefusal` should read the rung, not the career level,
   so world levels never make the Pit harder. Needs the arena Lead's agreement with item 4.

## 10. Deliberate divergences from the donor specs

1. **Our own rising curve** (linear to 10, a square term from 11) instead of EverQuest's cubic table, and a **Pit win pays one level
   at the Pit rung** however the curve rises, so "one win, one level" survives.
2. **No ExpMultiplier** or FinalExpMultiplier; base values are set directly.
3. **Falloff by level difference only**, the same at every level and both caps (tested 1–50 × −12..+12), sized for a title of five.
4. **Above-level bonus capped at ×1.25**, none for bosses; **grey at d ≤ −6** at every level.
5. **Bosses not split**; party size 1–4; a 10% contribution threshold instead of top damage takes the kill; no `(L+3)²` cap.
6. **Per-kill cap 250 CP** on by default. **No death penalty, no decay, no skill or stat gain by use.**
7. **Repeat heat keyed on mob kind**, charged on unpaid kills too, rounding partial heat up (UO's limiter counts only checks it
    lets through and expires each one whole).
8. **Rested allowance is a ceiling, not a bonus**, fixed in CP while the requirement rises.
9. **Legends beaten once**: no donor has it; it comes from the Pit's own ladder.
10. **No level-up ceremony** (a level shows when the server settles it); **credit counts past the cap**; **integer permille** maths.

## 11. Files

- `origins/progression/model.ts`: the pure reference model (`requirement`, `cumulative`, `levelOfCredit`, `creditFromMarks`,
  `fillPermille`, `tierOf`, `nextLegend`, `award`, `settleAll`, the tables). Its only import is `MAX_LEVEL` and `RANK_STEPS` from
  `src/career.ts`; integer-only, no clock or randomness.
- `origins/progression/scenarios.ts`: the worked examples and the two players of section 2.1.
- `origins/progression/model.test.ts`: 45 tests (`node:test`); `tests/origins-progression.test.ts` imports it so `npm test` runs them.
