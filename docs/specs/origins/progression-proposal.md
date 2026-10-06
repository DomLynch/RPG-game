# Origins progression: one career, two places to earn it (proposal)

- Author: impl-progression, 2026-10-06. For Strategy and Dom. Serves Dom's ruling 7; clean room under ruling 8 (written from this
  repo and the specs in this folder only).
- Status: **proposal**. Nothing here ships or changes `src/`. The executable half is `origins/progression/model.ts`. Every number
  and worked example below is pinned in `origins/progression/model.test.ts` (27 tests, Node's built-in runner, run on the VPS).
- Scale used throughout: **career level 1–46** (`src/career.ts`). Gladiator I is level 11 (10 Pit wins); "Gladiator = rank 3"
  in the rulings is the title tier, not the level.

---

## Page one, in plain English

**Nothing changes for the Pit.** One Pit win is still one level. Every existing player's level is exactly what it is today, and
wins still never go down.

**Under the hood the career becomes one number that the world also feeds.** One Pit win is worth 1,000 points of career credit,
and each 1,000 points is a level. The world pays into the same number:

| You do this | You get | Limit |
|---|---|---|
| Win a Pit fight | **1,000 (one level)**, same as today | none, same as today |
| Kill a world boss | **1,000 (one level)**, the same as a Pit win, never more | each boss once a week per character; you must have done at least a tenth of the work |
| Finish a story step / chapter (optional, Strategy decides) | 100 a step, 500 for the chapter | once ever |
| Kill an ordinary creature | **20** (a fiftieth of a win) | see below |
| Kill an elite / a named creature | 80 / 200 | see below |

**Creatures pay less when they are beneath you, and nothing when they are far beneath you.** A creature 3–4 levels below you pays
half. One five below pays a fifth. Six or more below (more than a whole title) pays nothing. A tougher creature pays a little more,
up to a quarter extra.

**Killing the same kind of creature over and over pays less and less.** The first three in a row pay in full; after that each
one pays less (the 4th three-quarters, the 6th half, the 10th under a third). The penalty wears off by itself, one kill's worth every
six minutes, so a player moving through a region never notices it. A player camping one spot does.

**Creature credit comes out of a "rested" allowance.** Everyone has an allowance of up to 3,000 points (three levels) for creature
kills. It refills by 1,500 a day, whether or not you play. When it is empty, creatures still drop loot and count for quests, but
add nothing to your rank until it refills. Pit wins and bosses never touch it. So the most a bot can squeeze from creatures is the
same as a player who plays for an hour a day.

**What it feels like.** A new Gladiator who plays the first region and chapter one in an evening goes from level 11 to 17, mostly
from the three bosses and the story. A level 30 farming starter creatures gets nothing, and a level 30 farming creatures five levels
down gets 3% of a Pit win per hour. A party of four that kills a boss each get their own full level, except the member who is well
above the boss, who gets half.

**What we did not take.** Losing experience when you die (EverQuest), skills that drop when you raise others (Ultima Online),
reputation that fades weekly, buying levels from trainers (Morrowind), and stat bonuses from levels that change hit chance (Gothic).
They all break "wins never go down" or the fixed combat rules.

**Decisions for Dom** are in section 9; the main one is whether story steps pay career credit at all.

---

## 1. The six key numbers

| # | Number | Value |
|---|---|---|
| 1 | Pit win | **1,000 CP = one level**; `level = min(46, 1 + floor(credit / 1000))` |
| 2 | World boss | **1,000 CP, never more**; once per boss per rolling 7 days; ≥ 10% contribution |
| 3 | Mob base | **ordinary 20, elite 80, named 200 CP**; no single non-boss kill above 250 |
| 4 | Level falloff (d = mob − you) | **+3 and up ×1.25 · +1..+2 ×1.10 · 0 ×1 · −1..−2 ×0.90 · −3..−4 ×0.50 · −5 ×0.20 · −6 and below 0** |
| 5 | Repeat decay | **per mob kind: 3 kills free, then ×3/(h+1); heat cools one kill per 6 minutes** |
| 6 | Rested allowance (mobs only) | **refills 1,500 CP/day, holds 3,000, starts full; empty = 0 CP from mobs** |

CP = career credit points. Everything is integer arithmetic on the server (permille multipliers, floor once at the end), so the same
inputs give the same award on every machine.

---

## 2. The career number and the migration

- **State.** One integer per character, `credit`, in CP. Rank, title, sub-rank, gates and the Pit difficulty all read
  `levelOfCredit(credit) = min(46, 1 + floor(credit / 1000))`, which is `src/career.ts levelOf` applied to `floor(credit / 1000)`.
- **Migration.** `credit := 1000 × server marks` (`account_seed.marks + verified claims`, as `standing_of()` computes today). The
  test `migrated marks give the same level as src/career.ts for every count` checks 0–120 marks against the real `levelOf`.
- **Pit wins never change meaning.** The verifier still replays the record, applies the dial floor and the one-win-per-fight index;
  a settled win adds exactly 1,000. It ignores the rested pool, heat and everything else world-side (pinned: 40 straight wins from
  an empty pool and a hot heat table each add exactly one level).
- **`levelRefusal` and the dial.** They keep their logic and take `floor(credit / 1000)` where they take marks today. If world
  credit lifts a player's rank, the Pit's dial lets them trail up to 5 levels below it, exactly as after a losing streak.
- **Pit wins are still shown.** `pitWins` is kept as a separate count for the Pit board and the journal. It is never used for rank.
- **The rank bar gets its fill back.** `Rank.fill` (held at 0 today "so the bar code reads unchanged") becomes
  `credit mod 1000` in permille, so world credit visibly moves the bar between wins. At Origin the fill is 0.
- **Beyond Origin.** Credit keeps counting past 45,000 (useful for a later season); the level stays 46.
- **Monotonic.** No rule subtracts credit. Pinned by a property test over 20 random streams of 1,500 mixed events with retries and
  out-of-order timestamps: credit, level and every award are non-decreasing / non-negative.

## 3. Formulas

All multipliers are permille (1000 = ×1). `L` = the character's level from its credit **before** this event. Server time in whole
seconds; a time earlier than a stored clock counts as zero elapsed (clocks never run back).

### 3.1 Pit win
`cp = 1000`. Preconditions are today's verifier rules, unchanged.

### 3.2 World boss
```
eligible   = partyEligible(L, highest level in party)            // 3.5
           and contribution ≥ 100‰                               // server-measured share of the kill
           and (no credited kill of this boss in the last 7 × 86,400 s)
cp         = floor(1000 × min(1000, falloff(bossLevel − L)) / 1000)
```
- Each eligible member gets their own award; bosses are **not split**. "A world boss kill counts like an arena win" is per player.
- No bonus above you (the min with 1000): a boss is worth at most a Pit win, so over-level bosses cannot inflate rank.
- A grey boss pays 0 and does not start the lockout.

### 3.3 Ordinary, elite and named creatures
```
H    = max(L, other party members' levels)                      // the highest member sets the colour (EverQuest)
raw  = min(250, floor(base[class] × falloff(mobLevel − H) × partyShare(n) × repeat(h) / 10^9))
cp   = min(raw, floor(restedUnits / 86,400))
restedUnits −= cp × 86,400
heat[mobKind] += 360                                             // charged on every kill, paid or not
```
- `base`: ordinary 20, elite 80, named 200.
- `falloff(d)`: table in section 1, row 4.
- Party members must be in range and engaged (`present`) and inside the level gap (3.5); otherwise 0.
- The mob **kind** (definition id), not the spawn, is the repeat key, so camping a respawn point is the same as chain-killing.

### 3.4 Repeat heat
Per character, per mob kind: `units` (seconds) and `at`. Before a kill: `units := max(0, units − (now − at))`,
`h = floor(units / 360)`. `repeat(h) = 1000` if `h < 3`, else `floor(3000 / (h + 1))`:
h 0–2 → 1000, 3 → 750, 5 → 500, 9 → 300, 29 → 100, 59 → 50. Then `units += 360`.
One kill of a kind every 6 minutes or slower never heats; one every 75 s heats slowly (example A); one every 30 s collapses within
ten kills (example B2).

### 3.5 Party share and level gap
- `partyShare(n)`, n = 1..4: `floor((1000 + g/2) / n)` with `g = 1000 + 200(n − 1)` → **1000, 800, 566, 450**. More than four is
  refused.
- `partyEligible(Lm, H) = H − Lm ≤ max(5, floor(Lm / 2))`. A level 20 with a level 30 is eligible; a level 19 is not. A level 5 with a
  level 10 is eligible; a level 4 is not. An Origin cannot carry anyone below 31.

### 3.6 Rested allowance
`restedUnits` = CP × 86,400 so the refill is exact in integers. Before a mob award:
`restedUnits := min(3000 × 86,400, restedUnits + (now − restedAt) × 1500)`; `restedAt := max(restedAt, now)`.
New and migrated characters start full. Pit wins, bosses and story never read or write it.

### 3.7 Story credit (optional)
`cp` comes from content, is bounded to 0..1000 per step (a bigger number is refused, so a content typo cannot mint a rank) and pays
once per step id ever. Proposed amounts for chapter one: 100 per stage, 500 for the chapter.

### 3.8 Idempotency
Every event carries a server id: the record's `fight_hash` for Pit wins (as today), an encounter id per character for world kills,
the step id for story. One settlement per id is the server's unique index, not career state; the model's `settleAll` stands in for
it with a Set, and a retried id pays 0.

## 4. Anti-farm and bot resistance

| Lever | What it stops | Evidence |
|---|---|---|
| Grey band (6+ below = 0) | High levels farming starter zones | B1: an hour of level-11 hounds at level 30 = 0 CP |
| Highest member's colour + level gap | Power-levelling by a carry | C: an Origin carry makes everyone else ineligible and earns 0 himself |
| Repeat heat per kind | Camping one spawn | B2: one level-25 kind every 30 s at level 30 = 30 CP/hour |
| Rested allowance | Any 24/7 farm, bot or human | Property: mob credit in any span ≤ pool at its start + 1,500 × span / day. A full day ≤ 4,500 CP |
| Boss lockout + contribution | Boss farming, leeching | 7-day rolling lockout per boss; < 10% contribution = 0 |
| Per-kill cap 250 | A mis-tagged mob minting a rank | content-safety guard |
| Integer, server-time, server-roster inputs | Client-forged kills, clock games | section 5; a late event cannot invent a refill (pinned) |
| No death penalty, no decay | Nothing to "protect" by botting safe zones; nothing lost when away | wins never go down |

A bot's best day (B3): 24 hours on even-level mobs, 20 kinds in rotation, a kill every 15 s, earns **3,937 CP**. 3,062 of it comes in
the first hour (the full allowance any player has), then ~62/hour until every kind is overheated (hour 16), then nothing. Left
running for a week it earns **no more** (B4), because its kinds never cool. An honest player who plays an hour a day across a region
earns up to 1,500 CP a day from creatures and, more importantly, the bosses and the Pit, which a bot cannot farm.

## 5. Server-verification points (what the server must see before granting credit)

The browser never reports a kill. The authoritative world server (blueprint §4: "the game server owns live position, collision,
combat and encounter results") settles every world award; the existing VPS verifier keeps settling Pit wins.

| Event | The server must see | Where it comes from |
|---|---|---|
| Pit win | The claim and its record; replay says `killed`; dial floor holds against the server rank (`levelRefusal` on `floor(credit/1000)`); `fight_hash` unseen | Unchanged: `scripts/verify-loot.mjs`, `src/awards.ts` |
| Mob kill | Encounter id (unique per character); mob definition id, class and level from server content (never from the client); the kill on the server sim; party roster with each member's level **at engage** and `present` (in range, engaged within the fight); server timestamp | World server encounter result |
| Boss kill | As a mob, plus each member's contribution share (damage dealt or the encounter's defined equivalent) and the lockout row `(character, boss, last credited at)` | World server encounter result + `boss_lockouts` table |
| Story step | The quest state transition committed by the story service (blueprint §4: "advances important progression from verified events"); step id unseen for this character | Story service |
| Any award | The character's server state **before** the award (credit, rested, heat, lockouts); one atomic write of the new state, the award row and the event id | One transaction, as `verify-loot` does for marks + awards today |

Durable state per character: `credit bigint`, `pit_wins int`, `rested_units bigint`, `rested_at`, heat rows `(character, mob_kind,
units, at)` (prunable once cooled), lockout rows, story step ids, and the award log keyed by event id. Client tables never write
any of it (RLS deny, as `awards` today).

## 6. Worked examples (pinned in model.test.ts)

Region 1 names and levels below are placeholders for the region-1 content lane.

### A. A Gladiator I clears region 1 and chapter one in an evening (`regionClear`)
Level 11 (10 Pit wins, credit 10,000), full allowance. About 2 h 35 min: 12 ash hounds (11), 10 grave thralls (12), 10 ferry wights
(13), 16 blood retainers (14), 12 court sentinels (15, elite), 2 vampire reeves (16, named), three bosses (Toll-Keeper 13,
Steward of Ash 15, Count of the Ruin 16), four chapter stages and the chapter.

| Source | CP |
|---|---|
| Three bosses | 3,000 |
| Story (4 × 100 + 500) | 900 |
| Ordinary mobs (48 kills) | 725 (ash hounds 160 of a possible 240: kills 75 s apart heat the kind) |
| Elites (12) | 1,018 |
| Named (2) | 440 |
| **Total** | **6,083 → credit 16,083, level 17 (Veteran II)** |

Rested left at the end: 977 of 3,000. Mobs are 36% of the evening; bosses and story are the rest (WoW's lesson: most levelling comes
from the authored content, not the grind). Six levels in an evening matches a good Pit evening, so neither path is the obvious one.

### B. A level-30 (Praetorian V) farming low creatures
- **B1, starter mobs:** an hour of level-11 ash hounds, one every 30 s: **0 CP** (grey). The kind still heats.
- **B2, five below:** an hour of one level-25 kind, one every 30 s (120 kills): **30 CP**, 3% of one Pit win. Per kill:
  4, 4, 4, 4, 3, 2, 2, 1, then mostly 1 and 0.
- **B3, a 24-hour bot on even-level mobs** (20 kinds, a kill every 15 s): **3,937 CP**; 3,062 in hour one, ≤ 63 in every later hour,
  0 from hour 16.
- **B4, the same bot for a week:** **3,937 CP**, nothing more.

### C. A party of four kills a boss
Levels 14, 15, 16 and 20; the Count of the Ruin is level 16; shares 30%, 25%, 35%, 10%.

| Member | Gap to highest (20) | Boss d | CP |
|---|---|---|---|
| 14 | 6 ≤ 7, eligible | +2 (no bonus for bosses) | 1,000 |
| 15 | 5, eligible | +1 | 1,000 |
| 16 | 4, eligible | 0 | 1,000 |
| 20 | 0 | −4 | 500 |

- Swap the 14 for an Origin (46): the 15, 16 and 20 are ineligible (gap) and the Origin's boss is grey. **Everyone gets 0.**
- The same party's elite kills (court sentinel, 15): with the level 20 present the colour is his (−5 → ×0.2) and the share is 450‰:
  **7 CP each**. Without him (three of 14–16): **40 CP each**. Solo at 15: **80 CP**.
- Party mob credit, like solo, comes out of each member's own allowance.

## 7. What each donor contributes, and what we leave out

| Donor | Taken | Left out, and why |
|---|---|---|
| **EverQuest** (eqemu-experience.md) | Consider-colour falloff (§5.2) as our six bands; grey = 0 (§6); the highest member sets the colour (§7); group pool formula `X(1 + g/2)/n` with `g = 1 + 0.2(n−1)` (§5.4); level-gap eligibility `max(5, floor(L/2))` (§5.4); a per-kill cap (§5.3 step 9); "a percentage of a level" for fixed rewards (§5.9) as the model for boss and Pit credit | Cubic XP table (§5.6) and the 0.5 ExpMultiplier (would change level = 1 + wins); death XP loss and de-levelling (§5.8; breaks "never go down"); AA points; hot zones; race/class bonuses; the `(L+3)²` per-member cap (the colour and gap rules already stop carries); top-damage-gets-the-kill (§6; replaced by per-member contribution) |
| **Ultima Online** (modernuo-skill-stat-gain.md, modernuo-virtues.md, modernuo-champion-spawns.md) | Gain is better when the outcome is uncertain (§4.2) → harder creatures pay more, trivial ones nothing; the anti-macro key "same skill, same target, allowance 3, 5-minute expiry" (§4.3) → our repeat heat keyed on mob kind, 3 free, 6-minute cooling; per-deed rolling windows (virtues §4.2 "24 h since last gain", Sacrifice once per day) → the rolling boss lockout; weekly windows (virtues §4.4) → the 7-day lockout length; champion spawns' kill bar (§4.3) as the shape for a public event that pays one boss credit at the end | Use-based skill gain and the 700 total cap with atrophy (§4.6; skills going down breaks the ruling, and blueprint §7 rejects unrestricted skill-by-use grinding); stat gain from use (§4.8–4.9); weekly virtue decay (career never decays) |
| **World of Warcraft** (published design, not a spec) | Rested pool, turned from a bonus into the ceiling on creature credit; quests as the main source and kills the minority (example A); grey creatures give nothing; group kills give each member credit for quest bosses | Rested as a *double XP* bonus (it rewards logging off but leaves bots unbounded); an XP curve that grows per level (keeps level = 1 + wins) |
| **Morrowind** (openmw-levelling-skills.md) | Overflow carries over into the next level (§4.7, "12 becomes 2") → fractional credit carries and the rank bar fills; levelling is settled at a safe point (§4.5, on sleep) → awards settle on the server, not at the moment of the hit | Skill-use progression and attribute multipliers (§4.2–4.6); buying skill points from trainers for gold (§4.9; pay-to-rank); jail skill loss (§4.10) |
| **Gothic II** (gothic-progression.md) | `level / exp / exp_next` as a plain stored model (§4) → one stored credit, level derived; earning first and learning from mentors (§1, §8) → mentors unlock *techniques* gated by level (for the Stats lane, section 8) | Talents that change hit chance or damage (§5.4; the fixed spine forbids it); the retail XP curve (not in the spec, and not ours to derive) |

## 8. Fixed spine and stats

- Progression changes **no** combat number: the Attack/RES caps 1.15/0.80, gear scoring resolved before the fight, and every
  attack/parry/roll timing stay exactly as `src/gear-stats.ts` defines them. Career level already sets the Pit opponent's
  difficulty; that is unchanged.
- One stat set: whatever the Stats lane adopts (the draft STR/DEX/VIG/END/POISE of `docs/progression-direction.md`) reads from this
  one career level. This proposal adds no second currency for stats and no use-based stat gain. Mentor techniques (Gothic) and any
  Origin allocation are unlocked by career level, are free to respec, and are normalised wherever competitive play needs it.

## 9. Open decisions for Strategy and Dom

1. **Story credit.** Should chapter steps pay career credit (proposed 100 a step, 500 a chapter, once ever)? Without it, example A
   ends at level 16 instead of 17 and the world leans harder on bosses.
2. **Allowance size.** 1,500/day and 3,000 cap are the bot ceiling. Halving them halves what a bot can take and what a casual
   player gets from creatures; bosses and the Pit are untouched either way.
3. **Lockout length.** 7 days per boss is the WoW world-boss rhythm. A daily lockout would make region 1 worth three levels a day
   from bosses alone.
4. **Pit difficulty after world levels.** World credit raises the level the Pit fights at. The dial already absorbs up to 5 levels;
   if playtests show world players struggling in the Pit, the alternative is a Pit dial that starts at the Pit-win level.

## 10. Deliberate divergences from the donor specs (complete list)

1. **Linear 1,000 CP per level** instead of EverQuest's cubic table (`need(L) = (L−1)³ × mod × 1000`, eqemu §5.6), so a Pit win
   stays exactly one level.
2. **No ExpMultiplier 0.5** (eqemu §4) or FinalExpMultiplier; base values are set directly.
3. **Falloff bands by level difference only**, fixed for every level, instead of EverQuest's level-dependent grey/green thresholds
   (eqemu §5.2); six bands sized for a 46-level ladder with five levels a title.
4. **Above-level bonus capped at ×1.25** (EverQuest Red is ×1.50, Yellow ×1.25), and **bosses get no above-level bonus at all**.
5. **Grey at d ≤ −6** for every level (EverQuest: no grey below level 16 until d ≤ −6, then scaling).
6. **Bosses are not split** among the party (EverQuest splits every kill); each eligible member gets a full award.
7. **Party size 1–4**, not EverQuest's 6 (group) or raid; the raid split is not used.
8. **No per-member `(L+3)²·262.5` cap** (eqemu §5.4); the highest-member colour and the gap rule do that job.
9. **Per-member contribution threshold (10%)** instead of top-damage-takes-the-kill (eqemu §6).
10. **Per-kill cap 250 CP** as a content guard, on by default (EverQuest's per-kill cap is off by default, eqemu §4).
11. **No death penalty** (eqemu §5.8) and no resurrection refund.
12. **No AA, hot zones, race/class or leadership XP** (eqemu §5.3).
13. **Repeat-kill decay**, which EverQuest does not have (eqemu §10): keyed on mob kind, with allowance 3 and linear cooling of 360 s
    per kill, adapted from UO's anti-macro limiter (allowance 3, 5-minute expiry, keyed on skill and target; modernuo §4.3), which
    is off by default and exempts combat skills there.
14. **Heat is charged on unpaid kills too** (grey or rested-out), so farming a grey kind still warms it. UO's limiter only counts
    checks it lets through.
15. **No skill gain by use, no total skill cap, no atrophy, no stat gain** (modernuo §4.2–4.9).
16. **No weekly decay** of the career (modernuo virtues §4.4); the 7-day window is used only as a boss lockout.
17. **Rested allowance is a ceiling, not a bonus** (WoW rested doubles kill XP); it starts full and refills by real time.
18. **No level-up ceremony requirement** (Morrowind levels only on sleep, openmw §4.5); a level is shown as soon as the server
    settles the award. The settle-then-show order is kept.
19. **No attribute multipliers, training for gold or jail** (openmw §4.6, §4.9, §4.10).
20. **No talent hit-chance or damage effects** (gothic §5.4), because of the fixed spine; mentors unlock techniques only.
21. **Credit counts past the level cap** (EverQuest clamps XP at the cap, eqemu §5.7 step 6); the level stays 46.
22. **Integer permille arithmetic** with one floor at the end, rather than EverQuest's float32 steps truncated at each stage.

## 11. Files

- `origins/progression/model.ts`: the pure reference model (`award`, `settleAll`, `levelOfCredit`, `creditFromMarks`,
  `fillPermille`, `falloffPermille`, `partySharePermille`, `partyEligible`, `repeatPermille`, `restedAvailable`, `heatAt`).
  No imports, integer-only, no clock or randomness.
- `origins/progression/scenarios.ts`: the worked examples as event lists.
- `origins/progression/model.test.ts`: 27 tests on Node's built-in runner (`node:test`, `node:assert/strict`), like `tests/*.test.ts`.
  Run on the VPS: `node --test origins/progression/model.test.ts`.
