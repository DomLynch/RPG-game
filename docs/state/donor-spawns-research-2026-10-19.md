# Donor research: starter kill pace, damage-share credit, crowding (Lead, 2026-10-19)

Asked by Dom via Strategy, as input to #3297 (per-layer spawns). A read-only research agent read `/mnt/frankendom-donors` on the VPS. Lead spot-checked three citations on the box: TrinityCore `Respawn.DynamicRateCreature = 10` / `DynamicMinimumCreature = 10`; 2004Scape chicken `respawnrate=50`, `hitpoints=3`; ModernUO `minDamage` = top/2, /4, /8, /16 by HitsMax. All three match. Anything not in the code is marked NOT FOUND. "Arithmetic" means our own calculation, not a donor number.

## 1. Early-zone kill pace

| Game | Mechanism | Numbers | Source (under /mnt/frankendom-donors) |
|---|---|---|---|
| 2004Scape, Lumbridge chickens | 9 in the pen, respawnrate 50 ticks × 0.6 s = 30 s, 3 HP | arithmetic: 1,080 kills/h ≈ 18/min | `2004Scape-Server/data/src/maps/m50_51.jm2` (id 41); `data/src/scripts/_unpack/all.npc:1074-1083`; `src/engine/World.ts:120` |
| 2004Scape, cows | 10 cows, respawn 90 ticks = 54 s | arithmetic: 667/h | `m50_50.jm2`, `m50_51.jm2` (id 81); `all.npc:2105-2116` |
| 2004Scape, goblins | 24 goblins, respawn 140 ticks = 84 s | arithmetic: 1,029/h | `m50_50.jm2` (id 100); `all.npc:2684` |
| AzerothCore, Northshire | ~100 spawns (Kobold Vermin 33, Kobold Worker 33, Young Wolf 34; area box drawn by us), all spawntimesecs 180 | arithmetic: 2,000/h ≈ 33/min | `azerothcore-azerothcore-wotlk/data/sql/base/db_world/creature.sql` |
| ModernUO | spawner default delay 5–10 min | — | `ModernUO/Projects/UOContent/Engines/Spawners/BaseSpawner.cs:49-50` |
| EQEmu | respawn ± variance/2, floor 100 ms | — | `EQEmu/zone/spawn2.cpp:120-131` |
| **Frankendom Zone 1** | 24 spawns, 75–300 s | arithmetic: 288–1,152/h for the WHOLE zone | — |

Per-hunter kills/h: NOT FOUND in any donor. Starter areas supply 667–2,000 kills/h per AREA. Frankendom's whole zone is at or below one donor starter pen.

## 2. Damage-share mechanics (the rule is Dom's: credit by damage contribution, no first-hit or last-hit steals)

| Game | Mechanism | Numbers | Source |
|---|---|---|---|
| ModernUO | qualify threshold relative to the TOP damager | ≥ top/2 (HitsMax < 200), /4 (≥ 200), /8 (≥ 1000), /16 (≥ 3000) | `ModernUO/Projects/UOContent/Mobiles/BaseCreature.cs:3436-3452` |
| ModernUO | damage entry lifetime | expires 2 min after that attacker's last hit | `ModernUO/Projects/Server/Mobiles/Mobile.cs:55,59,5766` |
| ModernUO | reset | full HP clears all entries | `Mobile.cs:2036-2043, 5802` |
| ModernUO | pooling | pet/summon damage counts to the master | `BaseCreature.cs:3350-3372` |
| ModernUO | split | every rights holder may loot; top damager drives the luck roll; fame/karma split by party size; corpse private 3 min | `Corpse.cs:94,303-321`; `Misc/LootPack.cs:92-112`; `BaseCreature.cs:3546-3580` |
| ModernUO | first-hit bonus | first damager ×1.25 before the threshold | `BaseCreature.cs:3425-3430` |
| 2004Scape | ledger | 16 slots, damage capped at remaining HP, top scorer gets the drop, no minimum, no timeout, cleared on respawn | `src/engine/entity/HeroPoints.ts`; `src/engine/entity/Npc.ts:290` |
| EQEmu | group pooling | top damager sums per group/raid; XP split equally; group bonus 1.2–1.8× for 2–5 | `EQEmu/zone/hate_list.cpp:107-151`; `zone/groups.cpp:902-913`; `zone/exp.cpp:1121-1183` |
| TrinityCore | qualify threshold | players must deal ≥ 50% of the mob's HP for full XP; XP scales below that | `TrinityCore-TrinityCore/src/server/game/Entities/Creature/Creature.cpp:1707-1711`; `Miscellaneous/Formulas.h:211-212` |
| TrinityCore | tap list | soft cap 5 players (+ their groups); cleared on evade | `Creature.h:75`; `Creature.cpp:1381-1398`; `AI/CreatureAI.cpp:313-316` |

## 3. Crowding

| Game | Mechanism | Numbers | Source |
|---|---|---|---|
| TrinityCore | dynamic respawn per zone: respawn × (rate / players), floor | rate 10 (no change up to 10 players, halved at 20), floor 10 s; only flagged spawn groups | `TrinityCore-TrinityCore/src/server/worldserver/worldserver.conf.dist:2006-2019`; `src/server/game/Maps/Map.cpp:2287-2330` |
| AzerothCore | same formula, OFF by default | rate 1, floor 10 s | `azerothcore-azerothcore-wotlk/src/server/apps/worldserver/worldserver.conf.dist:4836-4853`; `src/server/game/Maps/Map.cpp:1762-1800` |
| EQEmu | per-zone player cap | `maxclients` (0 = unlimited) | `EQEmu/zone/worldserver.cpp:354` |
| 2004Scape | one world per server, hard cap | 2,047 players | `2004Scape-Server/src/util/Environment.ts:58` |
| Layers / sharding | NOT FOUND in any emulator (WoW layering was retail-only) | — | — |
| Launch-day problems | NOT FOUND in code or docs | — | — |

## Lead recommendations

1. **Kill pace:** target ≥ 30 kills/h per hunter. Starter respawn 30–60 s (2004Scape's chicken pen: 9 at 30 s ≈ 18/min), or keep 75–300 s and scale the spawn count with layers. The donors put about 8–10 spawns per active hunter in a starter pen.
2. **Damage credit (Dom's rule):** a per-mob damage ledger. A player qualifies at ≥ 25% of the top damage (UO's mid tier). Entries expire 120 s after that player's last hit (UO). The ledger clears on full heal or evade (UO/Trinity). Pet damage goes to the owner. XP and gold split by damage share. The loot roll goes to the top share. No first-hit bonus, so UO's ×1.25 is dropped (it contradicts "no steals"). Every threshold is a row.
3. **Crowding:** per-layer spawns keyed by (layer, instance), layer cap about 20 hunters, plus TrinityCore's dynamic respawn inside a layer: respawn × min(1, 10 / players), floor 10–15 s, all as rows. Open a new layer at the cap. Note that prod presence maxLayers=8 is the real ceiling today (640 players per process, #3297).

Not found: EQEmu, UO and classic-WoW starter spawn seed data (not in these repos); per-hunter rates; launch post-mortems; any emulator layering code.
