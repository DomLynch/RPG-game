# ModernUO behaviour spec: champion spawns ("Evil in a Can")

- Donor: ModernUO (GPLv3), commit `261ea01ab4b7c49a043dfabc7f44703b648883f8`, read-only at `/opt/frankendom-shadow/work/expansion-donors/ModernUO` on the VPS. Paths are relative to `Projects/`.
- Spec author: analyst-modernuo. Clean-room: behaviour, formulas and constants only. Implementers must not open the donor tree.
- Destination: **world** (an escalating multi-wave encounter ending in a boss) with reward hooks into **economy** and **progression**.

## 1. Purpose

A champion spawn is an area encounter. While active it keeps a population of minions alive in a rectangle. Killing minions fills a kill bar; a full bar raises the level (one red skull per level). Every 4 levels the minion roster and population change ("sub-levels" 0..3). After the last level, a single boss (the champion) appears. If players stop killing, the spawn decays: every 30 minutes without a level-up it either just resets the bar, or loses a level, and eventually shuts down. Killing the boss pays out scrolls, artifacts and gold, then the spawn stops and waits to be restarted.

## 2. Files, functions, call graph

| Path:line | Function | Role |
|---|---|---|
| UOContent/Engines/CannedEvil/ChampionSpawn.cs:64-144 | fields | state (section 3) |
| ChampionSpawn.cs:169-188 | ctor | defaults: expire delay 30 min, restart delay 30 min; spawn area = ±24 tiles |
| ChampionSpawn.cs:209-233 | Level setter | red skull count = min(level, 16) |
| ChampionSpawn.cs:235-243 | maxLevel clamp | 0..18 |
| ChampionSpawn.cs:255-268 | kills changed | white skull update |
| ChampionSpawn.cs:297-311 | MaxKills | kills needed per level |
| ChampionSpawn.cs:313-338 | SetWhiteSkullCount | 0..4 progress markers |
| ChampionSpawn.cs:340-381 | Start | activate; random type option; maxLevel 16..18; 1 s heartbeat; expire time |
| ChampionSpawn.cs:383-419 | Stop | deactivate; restart scheduling; creature cleanup after 10 min |
| ChampionSpawn.cs:421-432 | BeginRestart / EndRestart | ready-to-activate after a delay |
| ChampionSpawn.cs:434-510 | CreateRandomSoT / CreateRandomPS / GiveScrollTo | per-kill scroll rewards (ML+) incl. justice protector copy |
| ChampionSpawn.cs:512-672 | OnSlice | the 1 s heartbeat: boss-dead handling, count kills, valor, scroll drops, level check, expire, respawn |
| ChampionSpawn.cs:674-695 | AdvanceLevel | level up or spawn the champion |
| ChampionSpawn.cs:697-762 | SpawnChampion | reset level/kills, create boss, leash |
| ChampionSpawn.cs:764 | MaxSpawn | population cap |
| ChampionSpawn.cs:766-817 | Respawn | top up population, leash each minion |
| ChampionSpawn.cs:819-843 | GetSpawnLocation | 20 random tries in the rectangle, else the spawn centre |
| ChampionSpawn.cs:845-875 | Level1/2/3, GetSubLevel, GetSubLevelfor | sub-level boundaries; a minion's sub-level by its type |
| ChampionSpawn.cs:877-910 | Spawn | pick a random type from the sub-level's list |
| ChampionSpawn.cs:912-938 | Expire | decay |
| ChampionSpawn.cs:1150-1174 | ExpireCreatures / DeleteCreatures | cleanup |
| ChampionSpawn.cs:1176-1291 | RegisterDamageTo / RegisterDamage / AwardArtifact / GiveArtifact / IsEligible | damage ledger and weighted artifact award |
| ChampionSpawn.cs:1339-1362 | AfterDeserialization | resume |
| ChampionSpawn.cs:1365-1504 | ChampionSpawnRegion | activation by entering, proximity activation, young/ghost exclusion, eject after death |
| UOContent/Engines/CannedEvil/ChampionSpawnInfo.cs:6-149 | type table | per type: boss type, 4 rosters (one per sub-level), title names |
| UOContent/Engines/CannedEvil/CannedEvilTimer.cs:63-107 | daily rotation | once per day pick one random dungeon spawn to be ready |
| UOContent/Engines/CannedEvil/DungeonChampionSpawn.cs:23; LLChampionSpawn.cs:70-71 | variants | dungeon: no star-room gate; Lost Lands: proximity activation |
| UOContent/Mobiles/Special/BaseChampion.cs:29-36, 58-68, 70-200, 203-265, 267-350 | boss rewards | artifact roll, power-scroll level roll, 6 scrolls to looters, valor 800, skull to a random looter, gold rain |
| UOContent/Mobiles/BaseCreature.cs:3344-3445 | GetLootingRights | who counts as a looter |
| UOContent/Engines/Virtues/Valor.cs:45-122 | Valor ability | start or advance a spawn with virtue points |

Call graph:

```
activation: region OnEnter with readyToActivate | daily rotation | staff | Valor knight
  └─ Start(): maxLevel = 16 + rand(0..2); heartbeat every 1 s; expireTime = now + 30 min
heartbeat OnSlice():
  ├─ boss exists?  boss deleted → register boss damage → (ML) AwardArtifact(roll) → clear damage → gate → boss = null → Stop()
  │                otherwise nothing else happens while the boss lives
  ├─ for each tracked minion that is gone: kills++; register its damage; valor + titles to the killer; (ML) scroll roll
  ├─ p = floor(kills / MaxKills × 100); p ≥ 99 → AdvanceLevel(); else white skulls = floor(p/20)
  ├─ now ≥ expireTime → Expire()
  └─ Respawn(): spawn until population = MaxSpawn
AdvanceLevel(): expireTime reset; level < maxLevel → level++, kills = 0; else SpawnChampion()
boss death (its own hooks): GivePowerScrolls (Felucca), skull to random looter (Felucca), gold rain
```

## 3. Data structures

| Field | Type | Meaning |
|---|---|---|
| active | bool | running |
| type | enum | which roster/boss (9 types live) |
| randomizeType | bool | pick one of 5 types on each Start |
| level | int | 0..maxLevel (red skulls = min(level, 16)) |
| maxLevel | int | 16..18 per run (clamped 0..18) |
| kills | int | kills toward the current level |
| creatures | list | live minions this spawn owns |
| champion | ref or null | the boss while alive |
| spawnArea | rectangle | default centre ±24 tiles (49×49) |
| confinedRoaming | bool | leash to centre vs to own spawn point |
| expireDelay / expireTime | duration / time | 30 min; decay deadline |
| restartDelay / restartTime | duration / time | 30 min; when it becomes ready again |
| readyToActivate | bool | will start when a player enters |
| activatedByProximity / nextProximityTime | bool / time | Lost Lands crowd activation and 6 h lockout |
| activatedByValor / hasBeenAdvanced | bool | Valor bookkeeping (one Valor advance per run) |
| damageEntries | map player → int | accumulated player damage across all spawn kills (for the artifact) |
| whiteSkulls, redSkulls | lists | visual progress (strip) |

## 4. Formulas and constants

### 4.1 Kills per level (ChampionSpawn.cs:297-311)

| Level | MaxKills |
|---|---|
| 0–3 | 256 |
| 4–7 | 128 |
| 8–11 | 64 |
| 12–15 | 32 |
| 16+ | 16 |

Level-up test: `p = floor(kills / MaxKills × 100)`; level up when `p ≥ 99`. So the kills actually needed are `ceil(0.99 × MaxKills)`: **254, 127, 64, 32, 16**.

White skulls (progress): `floor(p / 20)` when `p > 0` in the heartbeat (0..4); the kills-changed hook only sets them when `p < 90`.

### 4.2 Sub-level (roster tier) and population (ChampionSpawn.cs:764, 845-854)

`subLevel = 0 if level ≤ 4; 1 if ≤ 8; 2 if ≤ 12; else 3`.

**Off-by-one surprise:** MaxKills changes at level 4 (≥ 4) but the roster changes after level 4 (≤ 4). Levels 4, 8 and 12 use the *lower* roster with the *higher* tier's kill count.

`MaxSpawn = 250 − 40 × subLevel` → 250 / 210 / 170 / 130 live minions.

Each respawned minion: type chosen uniformly from the sub-level's roster (2 types per roster typically; one roster has 5 in AOS+), placed at a random tile `(x, y)` with `x ∈ [areaX, areaX + width)`, `y ∈ [areaY, areaY + height)` where it can stand (up to 20 tries, else the spawn centre); not tamable; leash: confined → home = centre, range = min(width, height)/2; else home = its own position, range = floor(distance to the nearest rectangle edge along x or y).

### 4.3 Run length

maxLevel = 16 + uniform{0,1,2}. Levels 0..maxLevel−1 level up; completing level maxLevel spawns the boss (level and kills reset to 0).

Total minion kills to reach the boss (no decay): levels 0–3: 4 × 254 = 1,016; 4–7: 4 × 127 = 508; 8–11: 4 × 64 = 256; 12–15: 4 × 32 = 128; then 16 per level for levels 16..maxLevel:
- maxLevel 16: 1,016 + 508 + 256 + 128 + 16 = **1,924**
- maxLevel 17: **1,940**
- maxLevel 18: **1,956**

### 4.4 Decay (Expire, ChampionSpawn.cs:912-938)

Every heartbeat, if `now ≥ expireTime`:
1. `kills = 0`.
2. If there are **no white skulls** (progress < 20% of the bar): `level −= 1` if level > 0; then if not always-active and `level == 0` → **Stop**.
3. Else (≥ 20% progress): clear the white skulls (progress lost, level kept).
4. `expireTime = now + 30 min`.

expireTime is also reset on every level-up. So a group must reach at least 20% of the bar every 30 minutes to keep the level, and must finish a level within 30 minutes to keep its partial progress.

Note: a spawn at level 1 that expires with < 20% drops to 0 and **stops** in the same step.

### 4.5 Boss (ChampionSpawn.cs:697-762)

Created at the spawn centre 15 units below (the altar). Leash as in 4.2 with the boss's own position. While the boss is alive the heartbeat does nothing else (no respawn, no expire). When the boss object is gone: its damage is added to the ledger, ML+ artifact award (4.7), ledger cleared, a teleport gate appears (non-dungeon, Felucca only in ML+), boss = null, Stop.

### 4.6 Stop and restart (ChampionSpawn.cs:383-432; CannedEvilTimer.cs)

Stop: inactive, Valor flags cleared, maxLevel 0, heartbeat cancelled; if always-active → ready again after `restartDelay` (30 min); else if it was proximity-activated → proximity lockout 6 h; leftover minions are deleted 10 minutes later unless the spawn is active, ready, or always-active by then.

Daily rotation (dungeon set): once per day at the first heartbeat after midnight-ish (`today + 1 day`), every inactive (or active but level 0 with 0 kills) spawn is reset and **one random one** is marked ready.

Activation by entering: a non-staff player entering the region of a ready spawn starts it. Young players and ghosts cannot enter. Proximity spawns (Lost Lands) start after a 5-minute delay when ≥ 15 distinct non-young player connections (by address) are in the parent region.

Death inside: a player who dies in the region is moved out after 5 minutes if still dead (or their logout location is moved).

### 4.7 Rewards

**Per minion kill** (heartbeat; killer = most recent damager, or its master; must be a player):
- Valor `+40 × (minionSubLevel + 1)` (minionSubLevel by type; −1 if the type is not in any roster → 0 points), champion title progress.
- ML+ scroll roll: chance 0.1% in Felucca, 0.15% in Ilshenar/Tokuno, none elsewhere. Felucca: 50/50 Scroll of Transcendence (1..5 points) or a 105 power scroll; elsewhere: Transcendence (6..10).
- If the killer has a Justice protector meeting conditions: protector gets a copy with chance 60/80/100% by protector's Justice tier.

**Boss kill** (BaseChampion):
- Looting rights (BaseCreature.cs:3344-3445): sum each player's damage (pets/summons credited to masters); the last entry processed ("first damager" in descending-damage-entry iteration) gets ×1.25; sort; `minDamage = top / 16` if boss hitsMax ≥ 3,000, `/8` if ≥ 1,000, `/4` if ≥ 200, else `/2`; rights = damage ≥ minDamage.
- Felucca only: each rights-holder +800 Valor; then shuffle holders and give **6** power scrolls round-robin (holder i mod n). Scroll level: `R < 0.05` → 120 (20 points over 100), `< 0.40` → 115, else 110. Justice protector copies as above.
- Felucca only: champion skull to a uniformly random rights-holder (or the corpse if none).
- Gold rain (unless disabled): for every tile within radius 12 of the boss, after a random 0..10 s delay, if a spot fits within ±3 z: a pile of uniform 500..1,000 gold; 95% of piles also play a random effect (cosmetic).
- ML+ artifact (on the spawn): `R < 0.05` unique list, `< 0.15` shared list, `< 0.30` decorative list, else none (70%). Recipient: weighted by the spawn's **whole-run** damage ledger among eligible players (alive, in the spawn region, backpack can hold it). Loop: draw `r = uniform int 1..T` (T = eligible total damage); walk entries in ledger order accumulating; the first entry whose running sum **> r** wins; if it cannot take the item it is removed and the draw repeats; if no eligible entries remain the artifact is deleted.

**Artifact weighting quirk:** with entries d1..dn and cumulative Ck, entry k wins for `r ∈ [C(k−1), Ck − 1]`, except entry 1 which covers `[1, C1 − 1]`; `r = T` wins nobody and redraws. So entry 1 is under-weighted by one unit and, **if the only eligible player has dealt exactly 1 damage, the loop never terminates** (donor bug; guard against it).

### 4.8 Valor interaction (Valor.cs:45-122)

Active spawn, not yet advanced this run: by sub-level 0/1/2/3 need 2,500/5,000/10,000/20,000 Valor, spend 2,500/5,000/7,500/10,000 → `AdvanceLevel()` (one free level). Inactive spawn: Knight of Valor spends 11,000 to Start it.

## 5. Order of operations (one heartbeat, boss absent)

1. Inactive/deleted → return.
2. Snapshot kills.
3. Walk the minion list in order; for each deleted minion: start its corpse decay (1 min), remove it, `kills += 1`, register its damage, find killer, Valor + titles, (ML) scroll roll.
4. If kills changed → refresh properties.
5. `p = floor(kills / MaxKills × 100)`; `p ≥ 99` → AdvanceLevel; else if `p > 0` → white skulls `floor(p/20)`.
6. `now ≥ expireTime` → Expire.
7. Respawn to MaxSpawn (uses the *new* level's sub-level).

## 6. Edge cases

- Kills counted in one heartbeat can exceed MaxKills; surplus is discarded by AdvanceLevel (kills = 0). Only **one** level per heartbeat.
- Level-up at the last level spawns the boss in the same heartbeat; Respawn then returns early because the boss exists, but **existing minions stay** and keep fighting. While the boss lives the heartbeat returns before the kill-counting step, so minion kills in the boss phase give no kills, no Valor and no scroll rolls; once the boss is gone the spawn stops and those minions are never counted.
- Minions killed by non-players still count for kills (only rewards need a player).
- Expire with white skulls only resets progress; level never drops while you keep ≥ 20%.
- Staff setting maxLevel above 18 is clamped to 18.

## 7. Randomness

Shared `System.Random`. Draws: Start (type if randomized: `Random(5)`; maxLevel `Random(3)`), each respawn (type index `Random(len)`; up to 20 × 2 position draws), per counted kill on ML maps (`RandomDouble` for the scroll, `RandomBool`, scroll content), boss rewards (artifact `RandomDouble`, artifact list element, power scroll levels, shuffle, skull holder, gold amounts and delays, Justice `Random(100)`), weighted artifact draws.

## 8. Timing

| Item | Value |
|---|---|
| Heartbeat | 1 s |
| Expire / decay window | 30 min (reset on level-up) |
| Restart delay | 30 min (always-active spawns) |
| Minion cleanup after stop | 10 min |
| Corpse decay of counted minions | 1 min |
| Proximity activation delay / lockout | 5 min / 6 h |
| Dead-player eject | 5 min |
| Daily rotation | once per day |
| Gold rain spread | 0..10 s per tile |

## 9. Engine plumbing to strip

Skull/altar/platform/idol items and hues, light levels, effects and sounds, region registration (replace with an arena-room "inside" test), star-room gate, map names (Felucca/Ilshenar/Tokuno/Trammel/Malas rules → Frankendom world zones), young-player and ghost rules, IP-address crowd counting, properties gumps, serialization and migration, commands. The roster table is UO content (monster type names) and must be replaced with Frankendom opponents.

## 10. Golden cases (hand-derived)

| # | Input | Expected |
|---|---|---|
| S1 | level 0, kills 253 | p = 98 → no level; white skulls 4 |
| S2 | level 0, kills 254 | p = 99 → level 1, kills 0 |
| S3 | level 5, kills 126 / 127 | p 98 / 99 → stay / level 6 |
| S4 | level 10, kills 63 | p = floor(98.4) = 98 → stay; 64 → level 11 |
| S5 | level 14, kills 31 | p 96 → stay; 32 → level 15 |
| S6 | level 4 | MaxKills 128, subLevel 0, MaxSpawn 250 |
| S7 | level 13 | MaxKills 32, subLevel 3, MaxSpawn 130 |
| S8 | maxLevel 17, level 17 completes | SpawnChampion: level 0, kills 0, boss present |
| S9 | full run, maxLevel 16, no decay | 1,924 minion kills |
| S10 | level 6, kills 20 (p = 15, 0 white skulls), expire | kills 0, level 5, expire +30 min |
| S11 | level 6, kills 30 (p = 23, 1 white skull), expire | kills 0, level 6, white skulls 0 |
| S12 | level 1, kills 10 (p = 3), expire | level 0 → Stop (inactive) |
| S13 | minion from roster index 2 killed by a player | +120 Valor |
| S14 | boss hitsMax 5,000; player damage A 4,000 (last processed), B 1,000, C 200 | A ×1.25 = 5,000 top; min = 5,000/16 = 312 → A, B have rights; C does not |
| S15 | power scroll rolls R = 0.03, 0.2, 0.7 | 120, 115, 110 |
| S16 | 4 rights-holders, shuffled [B, D, A, C] | scrolls to B, D, A, C, B, D |
| S17 | artifact ledger [P1: 10, P2: 30], r = 10 | running 10 > 10? no; 40 > 10 → **P2**; r = 9 → **P1**; r = 40 → nobody → redraw |
| S18 | artifact ledger [P1: 1] only | r always 1, 1 > 1 false → infinite loop (donor bug) |

### How to capture goldens on the VPS later (do not build now)

- Pure-ish functions: `ChampionSpawn.MaxKills` (set `Level`), `GetSubLevel`, `MaxSpawn`, `Expire()`, `AdvanceLevel()`, `OnSlice()` with a pre-filled `Creatures` list of deleted mobiles, `AwardArtifact(item)` with a scripted RNG, `BaseCreature.GetLootingRights(entries, hitsMax)`.
- Harness: xUnit in `Projects/UOContent.Tests` (sequential fixture). A `ChampionSpawn` needs a map; the fixture configures test maps (`TestMapDefinitions`). Construct the spawn, move it to a test map, call `Start()` then drive `OnSlice()` manually (do not wait on the 1 s timer); set `Core._now` to cross expire boundaries; replace `BuiltInRng.Generator` for maxLevel/rosters. Avoid boss death paths that need full combat; call `GetLootingRights` with constructed damage entries instead.
- Build: .NET SDK 10.0.201; VPS only.
