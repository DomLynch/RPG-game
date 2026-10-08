# Zone runtime: a zone is data (design, one page)

Owner: Lead. Decided 2026-10-08 under Dom's authority (decision 3 of the architecture brief, `docs/state/lead.md` 21:30). Dom: "especially the zone 2 data thing to scale to 700+ zones".

**Acceptance (the bar for this design):** Zone 2 ships as data files (a spawn table, a kit list, a look file and a map) plus **at most ~300 lines of zone-specific code**, on the **same runtime** as Zone 1, at its own URL, with no change to runtime files beyond what Step 1 below does once. Nobody starts Zone 3 before Zone 2 meets this bar.

## What exists today (trunk 27086155d)
Facts from a read of `origins/` (182 TS files, 22.8k lines, 7.6k of them tests):
- **Most of the runtime is already generic** (~11.4k lines): contracts/, inventory/, progression/, feuds/, patrons/, crowd/, boss/, quests/, shops/, npcs/, mobs/ (row, populate, kits, styles), world/ (schema, resolve, derive, **generate**), combat/ (the Pit-copied duel), preview/ (world-combat, mobs-view, save, sticks, speeds), server/ routes.
- **Zone content is mostly data already** (~1.7k lines), but it's written as `.ts` files named for Region 1: `region1/content.ts` (ITEMS, LOOT_TABLES, FOES, ENCOUNTERS, REGIONS with spawns, plus TOWNS, BOUNTIES, KILL_ROWS…), `region1/world.ts` (WorldData checked against `world/schema.ts`), `mobs/frontier-rows.ts` (MobRow[] and openers), the `look.ts` PRESETS, `public/world/kit/zone1-kit.glb`.
- **The blocker is ~2k "mixed" lines where the runtime hard-codes Zone 1:**
  - `preview/main.ts`: `ARENA_THEMES['1']` :43, the sun :65, `?look=cinder` :78-80, the bounty giver :120, hint text :153, the west-gate exit :197, look stops :223.
  - `frontier-plan.ts`: `ZONE_NAMES` :34, `FRONTIER` :39, `SLICE_BOUNTY` :42, and `loadRegion1()` :57.
  - `mobs.ts`: `FRONTIER_ROWS` :11/:61/:64.
  - `play.ts`: `START_LEVEL = 16` :46.
  - `encounters.ts`: imports region1 at :15.
  - `server/mob-rewards.ts`: `FRONTIER_ROWS` at :13/:106.
  - `server/content-ops.ts`: `REGION1_*` at :9.
  - `presence/zones.ts`: a fixed list at :15.
- **The page has no zone id.** `/zone1/` is an nginx alias of `/preview/origins/` (`deploy/frankendom.com.conf:175`), and `REGION` is only an on/off switch (`main.ts:73`). The server spawn table in #1880 (migration 0014) is keyed by `instance` only, with no zone column.

## The design
1. **One zone package per zone:** `origins/zones/<zoneId>/`. Every file in it is data, validated at load:
   - `zone.ts`: id, display name, `level` (the zone number = its base level), region id, start point, exits/portals to other zones and the hub.
   - `world.ts`: WorldData (layout, passages, landmarks) in the existing `world/schema.ts` shape. It can come from `world/generate.ts` (`generateZone(template, seed)`) with hand overrides, which is how 700 zones stay affordable.
   - `content.ts`: the existing contracts BUNDLE + LOCAL shapes (foes, encounters, towns, bounties, loot, kill rows, NPCs, shops).
   - `spawns.ts`: MobRow[] + openers (the `frontier-rows.ts` shape). Levels come from the zone rule, not literals: common = `zone.level` near town up to `level+1` at the edge, named = `level+2`, boss = `level+3`.
   - `look.ts`: one look preset (sky, sun, fog, grade, day/night speed), in the `look.ts` PRESETS shape.
   - `kit.json`: the kit model path (`public/world/kit/<zoneId>-kit.glb`) and the dressing parameters (ground colours/heights, camp spots, fires), today hard-coded in `frontier-dress.ts`/`frontier-camp.ts`.
   - `hooks.ts` (optional, **≤ 300 lines; this is the budget the acceptance counts**): zone-only behaviour that isn't data yet. Anything a second zone also needs moves into the runtime.
2. **One runtime, a zone id in the URL.** Route `/zone/<n>/` (and `/zone1/` kept as an alias) → `?zone=<id>` → `loadZone(id)` returns the validated package, or a clear error page. `frontierPlan(zone)`, `mobs(zone)`, encounters, the look and the dressing all take the package; none imports `region1/` or `FRONTIER_*` again. `region1/` becomes `zones/zone1/`.
3. **The server is keyed by zone.** Spawns, kill rewards and respawn times read the zone's `spawns.ts` by id. The spawn table gains a `zone` column (`zone, instance` key) in a follow-up migration after #1880. #1880 ships as is; Zone 1 is the only zone until then. Presence zones come from the package list, not a fixed array.
4. **Mechanical guards, so zones stay data:**
   - **Lint:** nothing under `origins/` outside `zones/` imports `zones/<id>/` directly; only `loadZone` does. No zone imports `src/arena*` (the core/pit split, Combat).
   - **One validator** (generalising `region1/load.ts`) runs on every zone in CI. It checks the schema, every reference resolving, level rules and exits pointing at real zones.
   - **A golden spawn list per zone** (generalising `mobs.golden.json`).
   - **The Zone 2 budget check:** a test counts the non-data lines in `zones/zone2/hooks.ts` and fails above 300.

## Steps and owners
| # | Step | Owner | Done when |
|---|---|---|---|
| 1 | Extract Zone 1 into `zones/zone1/` and remove every hard-coded Zone-1 line listed above from the runtime; `loadZone`, `?zone=`; the live game identical (golden spawns, fingerprint and look stills unchanged) | World (runtime), Combat reviews the combat-side imports | `rg "region1\|FRONTIER_ROWS\|loadRegion1\|ARENA_THEMES" origins --glob '!zones/**'` returns nothing; release rows green |
| 2 | Zone column on spawns + server reads the zone package | Backend (migration with its own PRE/GO) | Zone 1 spawns come from `zones/zone1/spawns.ts` by id |
| 3 | Validator + lint + per-zone golden + budget test | Auditor/Code quality | CI fails on a zone that breaks the rules |
| 4 | **Zone 2 authored as data** (generated layout + hand overrides, its own kit and look) | World (layout/look), Characters (kit), Backend (spawns) | The acceptance bar above; live at `/zone/2/` |

Order: 1 → (2 ∥ 3) → 4. Step 1 runs alongside the core/pit split (Combat) and the seamless-engage fix (World); none of them changes the live game's behaviour.

## Not in this design
- Seamless borders between zones (walking from Zone 1 into Zone 2 with no load): a later design, once two zones exist.
- The content pipeline for hundreds of zones (generators, authoring tools): Step 4 proves the shape first.
- PvP across zones: async for beta (decision 5).
