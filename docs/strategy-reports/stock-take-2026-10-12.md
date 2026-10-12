# Frankendom stock-take, Monday 2026-10-12 09:1x (Strategy)

Dom's line: everything in the central game engine, content as data. Live at writing: BV 9fed82ba1 (my curl 08:52).

## 1. What is live (receipts: my curls and ancestry checks on 10-11, Lead's inventory at 9fed82ba1)
- Engine: one fight engine (src/fight) behind one door; Pit and zones are clients. Controls, camera, actors, gore, finishers, HUD in the engine. Boundary rows K7 + core C1-C7 green on live.
- Core: account, one ledger (bank, kill path), career service (server), leaderboards with stable Fighter #N, Profile card, QA test account (is_test), daily DB backup (first unattended run 03:17 per Lead, not checked by me).
- Modes: Pit; Zones 1, 2, 3 as data rows; registry generated; Zone 3 = one row, no code (proven 10-11). Camera B default; landscape; Proof 1 seamless, Proof 2 pipeline, Proof 3 many-on-one (crowd-control ladder) live.
- Release line: rows VPS-first, release owns the VPS, unit on VPS/HF-CPU, freeze-at-cut + orphan cancel, READY = label, merge-to-live 12-15 min (was 16-22; 7-8 is the target with the unit shard).

## 2. What the foundation allows now
- A new zone that reuses kit, creatures and a biome: one row, zero code (Zone 3). A new biome: one entry on the data path (biomes-data.ts is DATA per scripts/lib/data-only.mjs; Lead checked). So Zone 4 with its own biome = row + entry.
- A new creature, loot table, legend, gear tier, ladder, town, sound cue: STILL CODE (Lead's inventory, file:line). The character catalogue (catalogue-data.ts) exists but is NOT the Pit's runtime source: roster.ts, moves.ts OPPONENTS, legends.ts, ladder.ts run the Pit. Engine checklist row 20 NOT done (PR 1981 closed unmerged), row 21 all fields still code. Rows 18 (loot/XP server-side) and 19 (replay v41, old records refused) are done enough for beta.
- Bug to fix first: data-only.mjs lists src/assets/source/loot/loot.json which does not exist, and its line-9 comment still calls biomes code. The data gate protects a file that is not there.

## 3. Everything-as-data: the ruled order (one PR each, VPS receipt, label, Auditor PASS)
| # | Item | Size | Owner | When | Proof that it is data |
|---|---|---|---|---|---|
| 0 | Slice 3: world sim into Core (server-authoritative world) | M | Backend + Combat | today, draft 12:00 | C7 WORLD_SIM_KNOWN shrinks from 14 on live |
| 1 | data-only.mjs: fix the phantom loot.json path + stale comment; the gate test fails if a DATA_PATH is missing | S | Auditor | today | test red on a missing path |
| 2 | Zone 4 as a row with its own biome entry | S | World | today | /zone/4/ shows its own name and biome in the browser |
| 3 | Catalogue as runtime source, 20a: the Pit reads roster, opponents, ladder order from catalogue-data; fights byte-identical (replay fingerprints) | L | Characters + Combat | this week, PR by Wed | a new opponent = one catalogue row, appears in the ladder with no code |
| 4 | Loot tables → rows (content.ts:61) and legends → catalogue (src/legends.ts copy removed) | S | Backend (loot), Characters (legends) | Tue | a new loot table / legend name needs no code |
| 5 | Catalogue 20b: fields migrate one per PR: AI knobs, weapon id, specials list, home stance, voice, rank looks/tint/scale, gear tiers, wound art, finisher pose/seconds | M each | Characters + Combat | Wed-Fri | each field: a row edit changes the fight, no code |
| 6 | Mob looks into zone rows (zone 1 mobLooks), FOES per zone row | M | World + Characters | Thu | a new open-world mob = row + catalogue entry |
| 7 | Ladder as rows read by the client (server pit_ladder already rows), towns (content.ts:273 + load.ts:267), gear tiers (loot.ts:68 + grades.ts:15) | M | Backend / World / Web | Fri or next week | one row each |
| 8 | Tuning rows only for weapons, specials, bosses, finishers (numbers as data, FX and mechanics stay code); HUD strings table | L | Combat / Web | after beta | a damage or timing change is a row edit |

Rule: the proof column is the acceptance test, Zone-3 style, and every "as data" PR adds its path to DATA_PATHS so the gate enforces it. Nothing in row 8 before beta unless Dom asks for a specific tuning.

## 4. Three structural bets this week
1. The catalogue becomes the one source of character truth (rows 3, 5). Without it every new fighter is a code change across six files.
2. The world sim lives in Core (row 0): server-authoritative world = the MMO promise; the client only draws.
3. Content as rows behind the data gate (rows 1, 2, 4, 6, 7): Zone 3 proved the shape; repeat it per content type and the gate test keeps it true.

## 5. Quota and cost plan
- Claude: full week from 00:00 Monday; last week burned 93% by Saturday afternoon on 18+ releases/day. Plan: 8-12 releases/day, the COO's card every sweep, no percentage stop (Dom), lanes park on Dom's word only. Deploy and the Auditor are open whenever any lane is open.
- Hugging Face: ~$0.15-0.25 per release in T4 rows after the orphan fix (10-11: $2.09 used, $1.20 orphaned); unit runs ~$0.12/day. Credits were $3.43 on 10-11 15:3x with no auto-recharge; the COO warns at $1.00; top-up is Dom's call.
- Cycle time: merge-to-live target under 10 min once the unit shard is measured (first clean release today gives the number).

## 6. Owed to Dom this week
Phone fight with several attackers (Proof 3 feel); signed-in visit (ledger, career tab, boards); the three UI references (paper-doll gear, NEW-vs-EQUIPPED compare, in-world compact compare + HUD) go to Web after row 3 is cut; HF top-up decision.
