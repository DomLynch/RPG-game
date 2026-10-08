# Donor survey: zones as data (2026-10-08, Dom's ask)

Two read-only Sonnet agents over /mnt/frankendom-donors on the VPS (rg/ls/sed only). Question: which donor defines a zone (terrain/layout, spawns, NPCs, loot, exits) as DATA with a separable loader we could adapt for Frankendom's "one zone runtime, zones as data" design (#1913)? Scores are 1-5 for adaptability into a TS/Three.js runtime; GPL blocks copying code, not a data format.

## Part 1: MMO servers (agent 1, 13 repos, 33 tool calls)

Headline: none has a zone-as-data format to copy whole. Best fits: a spawn-list JSON shape (ModernUO), a per-square text map plus ini configs in TypeScript under MIT (2004Scape / LostCityRS), and a prototype-vs-instance map model (FOnline). Nothing beats the #1913 model; three artifacts refine it.

| Repo | Lang / licence | Zone unit and format | Data vs code | Loader (separable?) | Streaming | Score |
|---|---|---|---|---|---|---|
| veloren | Rust, GPL-3 | procedural chunks; `assets/world/manifests/spots.ron` placement rules; RON loot tables | loot/entities RON; terrain, placement, exits code | `world/src/lib.rs:339 generate_chunk` tied to sim (no) | per chunk `server/src/lib.rs:1188` | 1 |
| ModernUO | C#, GPL-3 | maps + `Data/regions.json`, `Data/teleporters.json`, `Data/Spawns/.../*.json` | spawns, exits, regions JSON; terrain binary MUL; loot code | `ImportSpawnersCommand.cs:29`, `MapLoader.cs:53`; schema ~150 lines copyable, runtime no | sector 8x8 `TileMatrix.cs:28` | 3 |
| EQEmu | C++, GPL-3 | `zone` row + `.map`; SQL tables spawn2/spawngroup/spawnentry/loottable/zone_points | all DB | `zone/zone.cpp:78 Bootup`, `:1187 LoadSpawnGroups`; ~9.2k lines, globals (no) | whole zone, one process per zone | 2 |
| azerothcore | C++, GPL-2 | maps/areas; `data/sql/base/db_world/creature.sql`, `gameobject.sql`, loot templates | DB rows; terrain binary | `Map.cpp:188 EnsureGridLoaded`, `GridObjectLoader.cpp` (no) | grid cells `Map.cpp:228` | 2 |
| 2004Scape-Server | TS, MIT | mapsquares 64x64 (`m<x>_<z>.jm2` text: `==== MAP ====`, `==== NPC ====` / `0 28 15: 149`), 8x8 zones; ini configs `[zeke] name=Zeke`; `.dbtable` drops | terrain, spawns, configs, drops data; behaviour RuneScript | `src/engine/GameMap.ts:48 init`, `:103 loadNpcs`; 428 lines, 150-200 reusable over own types | whole world at boot; zones for visibility | 4 |
| LostCityRS-Engine-TS | TS, MIT | same lineage; `GameMap.ts:75` loads maps from an in-memory bundle | same | `GameMap.ts:51 init`, `:135 loadNpcs` | whole world | 4 |
| OpenDAoC | C#, GPL-3 | Region > Zone > SubZone; SQL tables | DB | `WorldMgr.cs:231/423/544` (no) | whole region | 2 |
| Dawn-of-Light | C#, GPL-2 | Region/Zone; ORM tables `DOLDatabase/Tables/` (Regions, Zones, Mob, Teleport, ZonePoint, Area, LootTemplate) | DB; `Region.cs:788 LoadFromDatabase` | `WorldMgr.cs:319/519/832` (no) | whole region | 2 |
| rathena | C++, GPL-3 | map; one-line text: `ama_fild01,174,207,20,20 monster Kapha 1406,5,...`, `prontera,107,215,0 warp prt01 2,2,prt_in,240,139`, `mapflag`; YAML drops `db/map_drops.yml` | spawns, warps, flags, drops data; terrain binary cache | `src/map/map.cpp:3911 map_readallmaps` (no); line format ~40 lines to reimplement | whole map at boot | 3 |
| ryzomcore | C++, AGPL-3 | continent; XML `.primitive`; real content NOT in repo | n/a | `continent.cpp:395` NeL-bound (no) | yes `continent.cpp:886` | 1 |
| forgottenserver | C++, GPL-2 | one world `forgotten.otbm` + `forgotten-spawn.xml` (`<spawn centerx radius><monster name spawntime/>`) | spawns XML; monsters XML+Lua | `iomap.cpp:53`, `spawn.cpp:23` (ties to Game) | whole | 2 |
| otclient | C++/Lua, MIT | client only; OTBM reader `mapio.cpp:39`; has a browser build (unverified) | n/a | n/a | whole | 2 |
| cvet-fonline | C++/AngelScript, MIT | ProtoMap / ProtoLocation / ProtoCritter as ini-like text: `Examples/MinimalMultiplayer/Maps/TutorialMap.fomap` (`[ProtoMap] $Name Size WorkHex`), `Content/StarterContent.fopro` (`[ProtoCritter] [ProtoItem] [ProtoLocation]`) | prototypes data; scripts AngelScript; baked by `ProtoBaker.cpp` | `MapManager.cpp:54 LoadFromResources`, `:443 CreateMap`, `:597 DestroyMap`; 1573 lines engine-bound (no); prototype/instance split is the portable idea | whole map, instances on demand | 3 |

Agent 1 top 3:
1. 2004Scape-Server / LostCityRS: `src/engine/GameMap.ts`. The only TS + MIT zone loader; per-square data files split terrain, NPC spawns and object spawns; the LostCity bundle variant fits a browser.
2. cvet-fonline: `Examples/MinimalMultiplayer/Content/StarterContent.fopro`. Map, location and critters as short text prototypes; static prototype vs live instance maps `loadZone(id)`.
3. ModernUO: `Distribution/Data/Spawns/shared/felucca/Outdoors.json`. Cleanest spawn table as JSON (entries with maxCount, probability, homeRange, min/maxDelay); copy the schema idea, not the GPL files. Runner-up: rathena's one-line monster/warp/mapflag text.

Not verified by agent 1: loot-table formats beyond file names; DOL/EQEmu SQL columns; the otclient browser build.

## Part 2: RPG engines (agent 2, 17 repos, 38 tool calls)

Headline: two licence-clean, fully data-driven zone formats exist (Cataclysm-DDA JSON, Flare INI), both 2D; the 3D engines (OpenMW, Gothic, Daggerfall, Arena, Diablo) all read proprietary binaries, so only their streaming patterns are usable.

| Repo | Lang / licence | Zone unit and format | Data vs code | Loader (separable?) | Streaming | Score |
|---|---|---|---|---|---|---|
| Flare engine + game | C++, GPL-3 engine; data CC-BY-SA 3.0 | one INI-like text per map: `mods/empyrean_campaign/maps/abandoned_mines.txt` (`[header] width hero_pos music title`, layers, `[enemy] location category level number`, `[npc] filename`, `[event]`, `intermap=maps/x.txt,3,44`) | all data; loot in `mods/.../loot/*.txt` | `src/Map.cpp:224 Map::load` (1647 lines, singletons; no); format ~250 lines to reimplement in TS | whole map; optional procgen `Map.cpp:1695` | 4 |
| Cataclysm-DDA | C++, CC BY-SA 3.0 (LICENSE.txt; the Apache file in the repo is a font licence) | mapgen JSON keyed by `om_terrain`: `data/json/mapgen/house/house01.json` (904 files): `"rows": [ASCII grid]`, `"palettes"`, `place_monsters`, `place_loot`, `place_nested`; overmap specials for layout | all data | `src/mapgen.cpp:861 load_mapgen` (7860 lines, tangled; no); format separable | submap grid `map.cpp:9070 shift`, `:9288 loadn` | 4 |
| Crawl (DCSS) | C++/Lua, GPL-2+ | `.des` DSL vaults (`dat/des/branches/depths.des`: NAME/TAGS/KMONS/MAP..ENDMAP) + Lua | mostly data + Lua | `maps.cc:1528 read_maps`; `mapdef.cc` 6416 lines (no) | whole level | 2 |
| KeeperRL | C++, GPL-2 (+data clause) | settlements in custom text: `data_free/game_config/enemies.txt`, `map_layouts/` (`inhabitants = { count = {2 4} }`) | inhabitants/layouts data; terrain code | `model_builder.cpp:123` (no) | whole | 2 |
| OpenTESArena | C++, MIT | `MapDefinition`/`LevelDefinition` structs from proprietary MIF | runtime structs | not separable (MIF); `ChunkManager.cpp:46` 134 lines IS separable | chunked | 3 |
| OpenMW | C++, GPL-3 | ESM cells `components/esm3/loadcell.hpp`, `cellref.hpp` (door dest, teleport) | binary proprietary | `scene.cpp:427 loadCell`, `cellstore.cpp` (no) | exterior grid `scene.cpp:616 changeCellGrid`, `:1136 preloadCells` | 2 |
| OpenGothic | C++, MIT | Gothic ZEN via ZenKit; `world.cpp:66`, `worldobjects.cpp:67` | proprietary | no | whole | 2 |
| Daggerfall Unity | C#, MIT | RMB/RDB blocks from binaries; mod override `WorldDataReplacement.cs:204/342` | proprietary | Unity-bound | `StreamingWorld.cs:602` (1860 lines) | 2 |
| OpenEnroth | C++, LGPL | map table + proprietary maps; `Outdoor.cpp:428` | proprietary | no | whole | 2 |
| Exult | C++, GPL-2 | one world of superchunks `gamemap.cc` | binary + usecode | no | chunk on demand | 1 |
| GemRB | C++, GPL-2 | ARE binary via `AREImporter.cpp` (2619 lines); `MapMgr.h` 36-line importer interface; `.2da` text tables | proprietary areas | no | whole | 2 |
| OpenDiablo2 | Go, GPL-3 | DS1 stamps + levelPreset (`stamp.go`, `engine.go:161 PlaceStamp`, `map_generator.go:39`) | proprietary | no | whole region | 2 |
| Barony | C++, BSD-2 | binary `.lmp` (`files.cpp:2336 loadMap`, `maps.cpp:1204 generateDungeon`); no map data in repo | binary | no | whole | 2 |
| xu4 | C++, GPL-2 | U4 maps (`maploader.cpp:553`); Boron config | proprietary | no | whole | 2 |
| Wesnoth (brief) | C++, GPL-2 | WML scenario `.cfg` (`[scenario] id`, `[side]`, `[event]`, music macro) + separate text map (comma terrain codes) | data | `src/map/map.cpp:110 gamemap::read` | whole | 3 |
| VCMI (brief) | C++, GPL-2 | binary H3M; JSON object defs `config/objects/*.json` | maps binary, objects JSON | no | whole | 2 |

Agent 2 top 3: Flare `abandoned_mines.txt` (format), Cataclysm `house01.json` (template; CC BY-SA 3.0, format only), OpenMW `scene.cpp:616` (streaming pattern). Runner-up Wesnoth for its map/scenario split.

## Merged ranking and recommendation (Optimizer, 22:5x)

No donor has a 3D Three.js zone format; every 3D engine reads proprietary binaries. The map/terrain layer stays ours (GLB + look file). What the shelf gives us is the spawn/exits/loot/palette SCHEMA and the LOADER SHAPE, and it gives them cleanly:

1. Cataclysm-DDA mapgen JSON (CC BY-SA 3.0, per its LICENSE.txt; corrected by the Auditor 2026-10-08: FORMAT/SHAPE ONLY, no files copied). Zone-file grammar: rows + palette for the layout layer, `place_monsters` / `place_loot` / `place_nested` lists. JSON, 904 worked examples to learn the shape from. Use as the schema backbone.
2. Flare map file (format only; GPL engine, CC-BY-SA data). Header fields to adopt: entry point, music, title; `[enemy]` spawn groups with location/category/level/number; `intermap` exits in the same file. Closest single-file match to "spawn table + look + map + exits".
3. 2004Scape / LostCityRS `src/engine/GameMap.ts` (MIT, TypeScript). Loader reference in our language; per-region data files; the LostCity in-memory bundle variant for the browser. 150-200 lines reusable over our types.
4. FOnline prototypes (MIT). Runtime model: static prototype vs live instance; a location groups maps; `loadZone(id)` returns the validated prototype, instances are created/destroyed on demand.
5. ModernUO spawn JSON (GPL; schema idea only). Spawn entry fields: maxCount, probability, homeRange, minDelay/maxDelay.
6. Streaming, when a zone outgrows one load: OpenMW `changeCellGrid` and Cataclysm `map::shift` as the pattern; OpenTESArena `ChunkManager.cpp` (MIT, 134 lines) as the one liftable piece of code.

Recommendation for #1913: keep its acceptance as written; fill the zone schema with 1 + 2 + 5 (JSON or validated literal), take the loader shape from 3, the runtime model from 4, defer 6. Nothing here argues for copying a whole engine; everything argues for a ~300-line schema + loader of our own built from these shapes.

**Licence rule for anything lifted (Auditor, 2026-10-08):** code is copied only from MIT/Apache/BSD sources and keeps the original MIT notice (2004Scape/LostCityRS `GameMap.ts`, OpenTESArena `ChunkManager.cpp`). From GPL/AGPL/CC BY-SA sources (Cataclysm-DDA, Flare, ModernUO and the rest) only the format/shape is used, and no files are copied.
