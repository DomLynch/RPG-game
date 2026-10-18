# Zone package contract (step 1: the row shapes; no code)

## DESIGN v1 (2026-10-18, alpha item 1; Lead's order): the package, its manifest, what the loader validates, and Bone Hollow round-tripping

**What a package is.** One folder, the whole zone as rows and asset references, so Dom's Test Zone (and his later dungeon) lands in the main game by import with no `.ts` change. For Bone Hollow (zone 5) it is five files, produced today by `node scripts/zone-package.mjs export 5 <dir>`:

| File | What | Where it goes on import |
|---|---|---|
| `zone.row.json` | the zone row, verbatim | `origins/zone-rows/zone<N>.row.json` (the generator picks it up) |
| `dungeon.row.json` | the dungeon row (rooms, creatures, encounters, boss, mount, joins), when the zone names a dungeon | a row of `dungeon-rows.json`, replace-by-id else append |
| `theme.row.json` | the dungeon theme row (look, pieces, enclosure) | a row of `dungeon-themes.json`, same rule |
| `exits.json` | `{ owned, inbound }`: the exit rows standing in the package's world zones, and the rows in OTHER zones that arrive in it | rows of `exit-rows.json`, same rule |
| `package.json` | the manifest | read, never merged |

**The manifest** (`package.json`, schema 1; canonical JSON, 2 spaces, final newline):
`schema` (1), `id` (the dungeon id, else `zone<N>`), `zone` (the number), `unlisted` (a new package imports unlisted until Dom says so), `world` (its world-zone names), `owns` (`exits`, `dungeon`, `theme` ids), `inbound.exits` (rows elsewhere that arrive here: Bone Hollow's `cave-mouth` stands in the Cinder Fields), `uses` (`kit` urls, `characters`, `loot` ids: the references it needs to exist) and `files` (bytes and sha256 of every other file, so a changed package is a changed hash).

**What the loader validates on import** (the step-2 build; today's `zoneProblems`, the dungeon load checks and the registry already do most of it, the package check wires them together):
1. the manifest is schema 1, every listed file is present and its bytes and sha256 match, and there is no unlisted file;
2. the zone row passes `zoneProblems` (unknown keys, required keys, kit nodes, look colours, `mobLooks`, spawn rows) and, if it names a dungeon, the dungeon passes `loadDungeons` (graph, links, encounters, boss, a closed room needs a hall theme);
3. exit ownership: every `owned` exit stands in the package's `world`, every `inbound` exit has `to` equal to the zone number and stands outside it, and the arrive landmark of each exists on the far side;
4. every `uses` reference resolves in the shared tables (kit file in `public/`, within the per-zone budget; character ids in the roster; loot ids in the loot tables), because a package brings rows and assets, never code (the Beta rule below);
5. no collision: the zone number is free, and an id (dungeon, theme, exit) already present is refused unless the import says `replace`, so two packages cannot silently overwrite each other;
6. a package that is new imports `unlisted: true`.

**Import and export.** `exportPackage(N)` gathers the files from the shared tables; `importPackage` writes them back, a row replacing the row with its id, else appended. No loader change in step 1: the prototype reads and writes today's row files.

**Round trip, Bone Hollow (zone 5), `node scripts/zone-package.mjs check 5`:** export, import into copies of the shared tables with the package's rows removed, and compare. Result: **ok**. The zone row is byte-identical (same text, sha256 `e8e30f29b7fb`); the three shared tables hold the same rows (compared as canonical JSON by id, the rows' order in a shared file may differ because the import appends); and a second export gives byte-identical files (a fixed point), so `export(import(export(x))) == export(x)`. `tests/zone-package.test.ts` runs it for zone 5 (Bone Hollow) and zone 6 (the unlisted sample crypt) and checks that a tampered file is caught by its hash.
Exact byte identity of the SHARED files (`dungeon-rows.json` is hand-formatted, rooms one to a line) is not claimed: an importer cannot reproduce hand formatting. The step-2 answer is to make the package folder the source of truth and generate the shared tables from the packages the way `gen-zones` already generates the registry from `zone<N>.row.json`, which makes identity exact by construction. That is a migration of three tables and is Lead's call.

**Donors (what we take).**
- **OpenMW** (`components/esm3/loadtes3.hpp`, `loadcell.hpp`): a content file's header lists its **masters** (`std::vector<MasterData> mMaster`, name and size) and later records replace earlier ones by id; a CELL record is name, region, ambient / sunlight / fog, water level, then its references. We take the dependency list (`uses`), replace-by-id import, and a cell as one self-contained unit.
- **ModernUO** (`Distribution/Data/regions.json`, `map-definitions.json`, `Locations/*.json`): zone data is plain JSON keyed by map and name (`$type`, `Map`, `Name`, `Priority`, `Area` rectangles; maps with id, size, rules), spawns in per-map files, no code. We take regions as rows keyed by world zone with a priority, and one folder of JSON per map.
- **AzerothCore** (`areatrigger_teleport`: `ID`, `Name`, `target_map`, `target_position_x/y/z`, `target_orientation`; `dungeon_access_template`): a dungeon is a map plus its spawn rows plus teleport rows that name the far side's position, and an access row per dungeon. We take exits as rows the package OWNS with an explicit arrive target (our `exits.json`, `arrive` landmark), and the access row as a later field (level or key gate) beside `unlisted`.
- EQEmu `zone` / `zone_points` / `spawn2`, 2004Scape map files: already taken in the draft below.

**Split of work.** World (client and compiler side): the package folder, the export / import tool, the manifest and its checks, the dungeon and theme rows, the kit and look references. Backend (server and spawn side): `presence` and warps, the spawn rows' server reading, and agreeing the `exits` list on the zone row (gap 2) so the server loads an exit list from the package. Open for Backend: do the package's `inbound` exits need a server-side table, or do warps derive from the rows as they do for exit-rows today (#3044)?

**Backend's review folded in (2026-10-18, comment 6247572799).**
- **(a) Listing is a later milestone.** The server never reads `place.layout`: presence builds `ZONE_ROWS` from `frontierPlan(...)` (code) and the writer's `zoneSpawns` from the same plan, so a package with only a layout has no presence zone row, `placeOf` refuses a warp into it and nothing spawns for it. Importing it UNLISTED (the alpha-1 bar) needs none of that; LISTING, or making it an exit target, needs presence `ZONE_ROWS` and `zoneSpawns` to build from `place.layout`. That is gap 1's real size, and it is Backend and World together after alpha 1.
- **(b) Bodies.** Same rule as gap 5: a package NAMES existing creature bodies; a new body is trunk-first (the roster entry in code, and a DB migration for the `fighter_profiles` encounter allowlist, as `cave-troll` and the salamander needed). Zone numbers need no migration. Gap 3 gains that sentence; the Beta rule (roster bodies, all already allowed) is unchanged.
- **(c) "No `.ts` change" means no hand-written one.** An import regenerates `origins/zones/registry.ts` (generated, committed, `tests/zone-registry.test.ts` fails on a stale one). And the writer and presence read rows at module load, so importing or listing a package is a **cut with a writer and presence restart** (Deploy), not a hot load.
- **(d) Warps.** A package carries its own `warps` list, merged like `exits`.
- **(e) Backend writes the server-side package check** (`fightSetup(...).ok` for every spawn row, its loot ids exist, `zoneKeyProblems`, level bands, every exit's `to` is a listed zone and the far plan has the `arrive` landmark) and runs it in CI at import, not at runtime. World's importer calls it; it is not duplicated here.

**The shape of the zone row's `exits` and `warps` lists (for Backend's gap 2).** Both are lists of rows in exactly the shape of the shared tables they merge into, so one row means one thing in both places:
- `exits: ExitRow[]`, each `{ id, zone, landmark, to, arrive, warp, radiusM, arriveM, label }` (the eight required fields of `exit-rows.manifest.json`; `zone` is a world-zone name of THIS package). The loader merges them into `openExits(...)`. An exit id already in the global table is refused (collision), as for dungeons. `warp` ids are checked against the taken set (`exitWarps` already refuses a duplicate).
- `warps: WarpRow[]`, each `{ id, x, z, unit }` as in `warp-landmarks.json` (`unit: "m"`); ids must not collide with a global or exit-derived warp. In a package folder the two lists are `exits.json` (`owned`) and `warps.json`; the manifest's `owns` gains `warps`.
- Inbound exits (rows in other zones that arrive here) stay in the package's `exits.json` under `inbound` and are written to the same merge, so the far side's door exists only while the package does.

**Rulings (Lead, 2026-10-18).** (1) **Generate the shared files from the package folders, the gen-zones way.** A package folder is the one source of truth; `exit-rows.json`, `dungeon-rows.json`, `dungeon-themes.json` (and the zone registry) become build output, with a check that fails when one is hand-edited (it is regenerated and compared). Byte identity then holds everywhere, by construction. This is **step 2**. (2) **Inbound exits:** warps keep DERIVING from the package's exit rows (#3044); there is no second server-side exit table (one copy of each fact, the same rule as bounds). The server only validates that a package's exits point at real zones. Backend confirms in its review. (3) Backend reviews this doc, then Strategy signs off (alpha item 1).

**Step 2 BUILT (this PR, stacked on #3174):** `origins/packages/bone-hollow/` and `origins/packages/crypt-sample/` are the source; `npm run packages` (`scripts/gen-packages.mjs`) writes `exit-rows.json`, `dungeon-rows.json`, `dungeon-themes.json` (each with a "generated" marker) and each package's `origins/zone-rows/zone<N>.row.json` (a byte copy); `npm run zones` and the vite build run it first; `tests/package-registry.test.ts` fails on any hand edit. Facts found: a theme two dungeons share is carried once (the dungeon whose id sorts first owns it; the other lists it in `uses.theme`); the shared exit table keeps its old order (the door in from the far zone, then the door out). The import command (`node scripts/gen-packages.mjs import <dir> [--replace id,id]`) applies Strategy's rules, all in `validatePackage` and tested in `tests/zone-package-import.test.ts`: every bound is a row (`origins/zones/package-rules.json`, six named rules, counted); the manifest hash check is mandatory and a file not in the manifest is refused; a NEW package must say `unlisted: true`; a clash with an existing zone number, dungeon, theme, exit or warp id is refused unless that id is named in `--replace`; only the five known file names are accepted (no path, no `..`); an asset must be a local `/world/` or `/arena/` path that exists under `public/` (a remote URL, a scheme, `//` or `..` is refused). A refused import writes nothing. `node scripts/zone-package.mjs check <N> [root]` reads another checkout read-only: it returns ok for zone 90 on the Test Zone's branch (`origin/zone/goblin-field-dome` 53aaead, no shared tables yet = empty tables). Not built here: the server-side check (Backend's), `warps.json` merge into the warp table (gap 2, Backend), the biome table (gap 8), landmarks from `place.layout` (gap 1).

**Step 2 plan (original, kept for the record):** `origins/packages/<id>/` holds the five files; `scripts/gen-packages.mjs` assembles the three shared tables and the zone row files from every package folder in a fixed order (by id), writes them with a "GENERATED, do not edit" marker, and `tests/package-registry.test.ts` fails when a committed shared file differs from a fresh generation; the existing shared rows that belong to no package yet (the other zones) become packages by running `export` over each. The loader checks listed above run in the generator. The vite build and CI run the generator first, as they do for the zone registry.

**Not in this PR:** the loader check (step 2), the migration of the shared tables to generated-from-packages, any change to a `.ts` file under `origins/`.

---

Owner: World. Status: DRAFT for Backend (owner of the presence block, #3043 / #3044 / #3045) and the Test Zone Sandbox (the consumer). 2026-10-17, Lead's order (YES to the zone package contract).

**Rule (Lead):** a package is **rows + assets only**. Anything that needs code is listed under *Gaps* below, not hooked in. The bar is Dom's: the Test Zone becomes a main-game zone by importing rows, with no change to a `.ts` file.

**Where facts come from:** unless marked **[sandbox]**, a fact was read from trunk (`origin/codex/01a09a76/task-1`). **[sandbox]** marks what the Test Zone Sandbox reports from its branch `zone/goblin-field-dome` (53aaead), which is not on trunk and was not re-checked in a browser: `building-skins.json`, `props-defs.json`, `horizon-dome.ts`, the `goblin-fortress` biome and the rest of the Test Zone's mood.

Donor: EQEmu (`zone`, `zone_points`, `spawn2` / `spawngroup` / `spawnentry`, `ground_spawns`, `doors`, `object`), AzerothCore (`creature`, `gameobject`, `areatrigger_teleport` against `creature_template`), 2004Scape / LostCityRS (a map square is one text file with MAP / LOC / NPC sections, definitions in separate config). What we took: placements and per-zone settings live in rows keyed by the zone; definitions (a character, a loot table, an item) live once in shared tables and a zone names them by id; an exit is a row from a point in one zone to a point in another (`zone_points`, `areatrigger_teleport`); every reference is checked at load. Design only: EQEmu and AzerothCore are GPL, nothing is copied.

## What a package is today (read from trunk, not designed)

| Piece | Where it lives | Keyed by | Shape owner |
|---|---|---|---|
| The zone row | `origins/zone-rows/zone<N>.row.json` (registry generated by `scripts/gen-zones.mjs`; `N` is the zone number, level = N) | `N` | World |
| Its assets | the `kit.url` glb under `public/world/kit/`, any `look` picture files; more glbs are named by shared row files (**[sandbox]** `origins/world/building-skins.json`, `props-defs.json`), not by the zone row | path | Characters / World |
| Its biome (the shared mood a row names with `biome`) | `origins/zones/biomes-data.ts`, **TypeScript** today | biome id | World |
| Exits (doors to another zone) | `origins/zones/exit-rows.json` (one table for all zones) | exit `id`; `zone` = a world zone of the package | World |
| Presence (speed, quiet, caps) | the optional `presence` block on the zone row (#3043) | world-zone name | Backend reads, World owns the shape |
| Warps (where the server puts a player) | exit warps derived from the exit rows and the plan (#3044); every other warp (a start or respawn point) is a row of the GLOBAL `origins/presence/warp-landmarks.json` (`{ id, x, z, unit }`) today. **`presence.warps` does not exist on trunk** (Backend's review: the zone row's `presence` block is `{ speed?, quiet?, caps? }` only); a package carries its own `warps` list (below) | warp id | Backend |
| Characters, loot, items | the shared content bundle (`region1/content.ts` and the rows beside it); a zone names ids | id | Characters / Content |
| Townsfolk, shops | `origins/region1/npcs-defs.json`, `origins/region1/shops.json` | npc id | World / Backend |

### The zone row (the whole list of keys; `from-row.ts` `ROW_KEYS` refuses any other)
`name`, `defaultKind`, `names`, `world`, `biome`, `id`, `spawns`, `kit`, `looks`, `mobLooks`, `place`, `camera`, `look`, `unlisted`, `presence` (with #3043; trunk's `ROW_KEYS` has the other 15), `notes`.

- **Required:** `name`, `kit`, `looks`. Everything else is optional with its default in `origins/zones/schema.ts` or the biome.
- **`world`**: the list of world-zone names in the package (Zone 1 has seven). `names` maps each to its display name. Presence, exits and `place.zones` are all keyed by these names.
- **`spawns`**: `{ openers, rows }`. `rows` are mob rows (`src/core/world/row.ts`: id = a character id, `role`, `behaviour`, `level` band, `loot` id, `weight`, `rarity`); `openers` is the first fight per world zone. A package with no creatures is `{ "openers": {}, "rows": [] }` (the Test Zone row on trunk; the sandbox branch's version has five spawn rows and 18 placements, per the Sandbox).
- **`kit`**: `{ url, nodes, landmarks, kinds }`, the prop glb, its node names, its landmark names and how each kind of prop is scattered.
- **`looks`**: named look presets (fog, sun, ambient, exposure, ground). **`look`** is the zone's own overrides on its biome (`sky`, `props.kit`, `props.camp`, `fog`, `sun`, `ambient`, `exposure`, `ground`, `arena`).
- **`place`**: `{ zones, joins, waypoints, spawns }`. For each world zone: `zoneSize`, `layout` (landmark → `u`, `v`, `facing`, as fractions of the zone), `connections`, `density`, `ambience`. This is where a landmark's position is data (the Test Zone's `test-gate` and `test-camp` are `u`/`v` rows).
- **`camera`**: `{ preset }` and optional `passage`.
- **`mobLooks`**: `{ looks, spread }`, how this zone's creatures are dressed, by character id.
- **`presence`** (#3043): `{ "<world-zone>": { speed?, quiet?, caps?: { floor, soft, hard } } }`. Every key must be in `world`; defaults speed 1, quiet false, no caps; caps are fields only, nothing enforces them yet.

### Checks a package already passes at load (`zoneProblems`, `tests/zone-packages.test.ts`)
Unknown keys refused; `id` equals the file's number; required keys present; kit nodes and landmarks do not overlap; look colours are `#rrggbb` and in range; `defaultKind` is a roster body; every `mobLooks` id is a character that exists; spawn rows pass the mob-row validator. With #3043 merged, presence keys must also be world zones of the package.

## The contract (what the Test Zone must hand over)

1. **One row file** `zone<N>.row.json` and nothing else in code. `scripts/gen-zones.mjs` picks it up. A row that names a biome which exists is enough; a **new** biome is TypeScript today (gap 8).
2. **Assets** at the paths its `kit.url`, `look` and the shared skin / prop rows name, in the repo, within the per-zone budget (triangles / draw calls, Auditor). The Sandbox reports the goblin fort kit at 5.7 MB and the dungeon kit at about 1.1 MB, not yet measured against the budget.
3. **Exits it owns** as rows in `exit-rows.json`, each naming a landmark of one of its world zones and the landmark it arrives on.
4. **A `presence` block** only for world zones that differ from the defaults.
5. **References resolve:** every character id, loot id and shop id it names exists in the shared tables. A package that needs a *new* character or loot table brings those rows into the shared tables in the same PR; it never brings code.
6. **Unlisted until Dom says so:** `"unlisted": true` keeps a package off the map and out of the server's zone list (EQEmu `min_status`).

## Beta rule (Lead, 2026-10-17)

For beta a package may only spawn **bodies already in the roster** (`ROSTER`), name **existing** sky, look and loot ids, and use `place.layout` `u` / `v` rows for its landmarks. The later step, once the data layer is done, is *a body = a catalogue row + a glb through the registry, no roster code* (#3064's `world: { ... }` rows on the Pit bodies are the start). Each gap below is marked **BETA** (needed for the first Test Zone import to be rows only) or **LATER**; the ranking is Lead's, this is my proposal.

## Gaps (need code today; listed, not hooked)

1. **Landmark positions for generated zones.** A zone whose `place.layout` is `u`/`v` rows is pure data. Zone 1's world coordinates come from `origins/preview/frontier-plan.ts`, which is code. A package must use `layout` rows; the frontier plan is not available to it. **Checked 2026-10-17 on trunk** (`VITE_UNLISTED_ZONES=1`): `frontierPlan(true, '90')` returns only `pit-yard` and `exchange`, not the Test Zone's `test-field` with its `test-gate`, so an exit INTO a layout-only package cannot derive its landing warp today (Backend's #3044 reads the far landmark from this plan). **HARD RULE (Lead, 2026-10-17): a package cannot be an exit target (`to` of an exit row) until gap 1 lands.** **LATER** for a package nobody exits into (the Test Zone joins the marsh by a road join, not an exit); **BETA** the day a package is the target of an exit row, because then the plan has to build that package's landmarks from its `place.layout` rows.
2. **Exit rows are one global file**, not part of the package. Importing a package means editing `exit-rows.json`. Proposal: allow an `exits` list on the zone row (the field already exists in `schema.ts`, `wired: false`) and have the loader merge it. Needs Backend's agreement because warps derive from it. **BETA** for any package with a door; a package with no exit needs nothing.
3. **Characters and bodies.** A package names `defaultKind` and character ids; the roster (`ROSTER`) and `MOB_LOOKS` are TypeScript. A new body is code and cannot ship in a package. **LATER** (Lead): the beta rule above is roster bodies only; the later step is a body as a row plus an asset.
4. **Loot tables, items, shops** are in `region1/content.ts` (TypeScript literals) except where already moved to rows. A package that needs one has to wait for that table to be rows, or reuse an existing id. **LATER:** the beta rule is to reuse existing ids; a package with creatures also needs its loot ids to exist, which the load check refuses otherwise. The Test Zone (sandbox branch) names `loottable:giant-salamander` and others, and its `loadouts.json` names piece ids with no server loot rows behind them; those rows are the first thing to land before a Test Zone with creatures can ship.
5. **`look.sky` ids and the dome / backdrop render** are resolved by preview code; a package may name an existing sky, not define a new one. Split, per the Sandbox: the dome **render** is code (**[sandbox]** `origins/preview/horizon-dome.ts`); the palette and backdrop arcs are rows (`origins/world/goblin-field-defs.json`); the backdrop pictures are existing `public/arena/backdrop-N.webp`. The camp **dress** is code that reads rows (`frontier-camp.ts`, `frontier-dress.ts`, `camp-fire.ts`, `goblin-smoke.ts`, `goblin-ground.ts`, the skinned building renderer `frontier-kit-view.ts`, `mobs-view.ts` for dress and loadouts). The combat camera and framing numbers are biome rows, but their logic is `src/fight/follow-camera.ts`, and page-wide look flags (`?gfx`, `?mobsmooth`) are page code, not per zone. **LATER** for a new sky; **BETA only if Dom wants the Test Zone's look to ship in a beta zone** (Lead: his call, through the Sandbox).
6. **Quests, townsfolk placement, gather points, containers, safe areas** (`schema.ts` groups `population` / `interaction`) are `wired: false`: no reader exists, so a package cannot use them yet. **LATER:** the Test Zone has no creatures and uses none of them.
7. **The map position of a package** (`place.joins`, `waypoints`) assumes the Region 1 map. A package that joins no existing zone is an island; how an island appears on the world map is undecided. **LATER:** a beta package joins an existing zone through `place.joins` (the Test Zone joins the Drowned Marsh).

8. **The biome is TypeScript** (added from the Sandbox's reply). On trunk the biomes are the two entries (`ash-wastes`, `drowned-marsh`) of the literal `origins/zones/biomes-data.ts`; **[sandbox]** the Test Zone's `goblin-fortress` biome is a third entry on its branch and carries the whole mood: `look.sky`, props kit and density, the buildings skin, dress, ground material, creature UI, camera presets and the combat cameras. A new zone mood therefore needs a code edit. Moving the biomes to a JSON table through the registry (same pattern as #3057) makes a biome a row; it is the step that lets the Test Zone mood ship as rows. **BETA only if gap 5 is** (the same Dom decision); otherwise LATER.

## Open questions

- **Backend:** (a) is `presence` keyed per world zone enough for warps, or do warps want their own table when a package has no exit row? (b) can the server load an exit list from the zone row (gap 2) without a migration?
- **Test Zone Sandbox:** answered 2026-10-17 (read from `zone/goblin-field-dome` 53aaead, not re-checked in a browser): items 1 to 6 met except the biome (gap 8) and the loot rows (gap 4); gap 1 does not apply to it (its layout is `u` / `v` rows); package-able as rows today are the zone row, loadouts, skin fits, props rows, mob looks and (once the biome is JSON) the camera rows. **Still open for Dom:** does the Test Zone's look ship in a beta zone? (decides gaps 5 and 8).
- **Lead:** answered 2026-10-17: gap 3 is a later content-bundle step (see the Beta rule), not out of scope for good.

## Not in this spec

No code and no change to any existing row. The spec's only job is that Backend and the Sandbox agree what a package hands over, so the import is rows.
