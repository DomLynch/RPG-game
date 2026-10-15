# Frankendom engine parity checklist

Source: Lead Dev, two read-only Sonnet audits on trunk `9f4937e38`, 2026-10-09. Saved in Lead memory as `project_engine_parity_checklist_2026-10-09`. The Zone 2 exit test (K7) is written against rows 1-16 and 20.

Rule: the shared engine (`src/fight/`) is the whole fight. The Pit, Zone 1 and every zone are clients. "Pit" names only the Pit client (arena wall, ladder, start/finish screens). Never "the Pit's X" for anything in this table.

Zone 1's loop today: `main.ts` -> `world-combat.ts` -> `zone1.ts` -> `open-fight.ts`, stepping the engine's `stepDuel` + `decide` headless. `src/fight/` on trunk = `characters.ts` + `index.ts`.

| # | Item | Lives in today | Zone 1 has it | Slice |
|---|---|---|---|---|
| 1 | Duel step / sim | src/ (Pit-side) | yes | K2 |
| 2 | AI brain + per-rank profiles | src/ai, moves | yes | K2 |
| 3 | Guard / parry / roll / stamina / stance / gambit | src/ | yes | K2 |
| 4 | Fight loop (aggro, chase, leash, 60 Hz, events to page) | origins own copy | own copy | K2b / K2c delete |
| 5 | Controls / input, target lock | src/input | yes | K2c via facade |
| 6 | Hero actor + animations | src/fight | yes | K3, live in J4a |
| 7 | Creature actor / clips | origins own copy | own copy | K3 creatures, PR 1986 |
| 8 | Blood, wounds, pools, decals, hero blood-edge | src/gore, blood-*, finisher-blood | no | K5 |
| 9 | Finishers, execution, hamstrung, severed head, skull, dropped weapon, finisher slow clock | src/ | no | K6 (one release with K5) |
| 10 | Hit impact / hitstop, armfeel, sparks, dust | src/ | no (own pulse) | K4, World |
| 11 | Fight camera, camera kick, standoff | src/camera* | no (own follow cam) | K4 |
| 12 | Combat sound cues, creature cry, breath, power words | src/feedback, audio/* | no | K8, World & Audio |
| 13 | Specials: timing, FX (~2.5k lines), signatures, skill impact, mob signature kits | src/ | sim side only | K9, Combat |
| 14 | HUD: bars, damage numbers, stance panel, fatigue / tired body | src/hud.ts | own bars, no numbers | K10, Web |
| 15 | Gear dressing (wear, rank-look, rank-tint, grades) | src/fight + src/ | no | K11: hero = Web PR 2001; creature looks = Characters |
| 16 | Colour grade / quality | src/ | partial | K4 |
| 17 | Death / respawn / fight end | Pit match vs Zone own | own | by design (open-world respawn); K7 checks no Pit end screen |
| 18 | Loot roll, XP / career award | Pit loot/career vs Zone hunt.ts, mob-rewards | own, server-verified | post-K item 3: server tick unifies, Pit moves to server rewards |
| 19 | Fight record / replay | src/record | partial | post-K item 3 |
| 20 | Catalogue as runtime source (PR 1981) | src/fight, unmerged | no reader | K12, Characters + Combat |
| 21 | Catalogue missing fields: AI knobs, weapon, specials, home stance, voice/breath, rank looks/tint/scale, gear tiers, wound art, finisher pose/seconds, ladder order | src/ tables | partly own copies | K12, each field added as its K slice moves the code |
| 22 | Pit-only: coach, tutorial, lobby/pvp, share, ladder UI | src/ | no | by design |

## Slice order

K2b/c -> K3 creatures -> K5 + K6 -> K4 -> K8 -> K9 -> K10 -> K11 -> K12 -> K7 exit test (Zone 2 with zero combat code; rows 1-16 + 20 all served from `src/fight`).

## Status at 16:30 +04, 2026-10-09 (Lead and Combat report, not independently checked)

- K2b + K2c-1 = PR 2005 (draft, suite running). K2d (delete Zone 1's own creature-fight path, world-combat.ts moved into src/fight) = PR 2006 (draft, suite next). "Zone 1 on the shared engine" is true when 2006 is live.
- fight-load.ts stays: it is the walk page's entry into the Pit client, not Zone 1 combat.
- World started K8, Web started K10, in parallel.

## For the donor-decoding agent

Each finding from a donor game should name the row number above it lands on, plus the Frankendom file in the "Lives in" column (or `src/fight/` once the slice has moved it). Rows marked "by design" need no donor read. Rows 18 and 19 are owned by the post-K server-tick work; donor reads there are EQEmu zone tick and rathena map-server first.
