# Zone schema (A1 proposal) — World, 2026-10-09, for Strategy's review before any code

**Goal (Dom via Strategy/Lead):** a zone is a folder; EVERY visual, audio, placement, population and gameplay property of a zone is a data field with a default; a generated zone is a placeholder Dom reshapes; adding a field later costs ONE line, never a 700-folder migration. If Dom wants to change something that is not a field, that is a schema bug.

## Rules (Lead's three, plus ours)
1. Every field is **optional**; its default lives in the **schema** or the **biome preset**, never in a zone file. A zone file lists only its overrides.
2. The schema carries a **version**; the loader fills missing fields from defaults and runs per-version migration steps, so a zone written today loads unchanged later.
3. **No reserved/placeholder fields:** a field exists because it means something (empty by default is fine).
4. Every field has a `wired: true|false` marker and an owner lane in the field registry; a test prints the unwired list so Dom sees what takes effect today.
5. A zone names a **biome** and overrides fields by reference; presets are shared data (changing a preset changes every zone in it).

## Mechanism (A1, data and types only)
- `origins/zones/schema.ts` — `FIELDS`: the field registry, one row per field: `path` (`look.fog.density`), `type`, `default`, `group`, `wired`, `owner`, `donor?`. Everything below is derived from it: the `ZoneSpec` type (what a zone file may contain = all overrides, all optional), `ZONE_DEFAULTS`, the validator, the wired report. Adding a field = adding one row.
- `origins/zones/biomes.ts` — `BIOMES: Record<string, Partial<ZoneSpec>>`; `ash-wastes` first (Zones 1 and 2 share it, which folds the duplicated `zone1 / frontier-*` look entries in zone2/look.ts into one preset). Further biomes (pine-forest, marsh) are added when a zone needs them, not before.
- `resolveZone(spec) = defaults ← BIOMES[spec.biome] ← spec` (deep merge by path; arrays replace; `$ref` to a named preset row allowed inside list fields). Unknown fields are an error (a typo must not vanish). `schemaVersion` on the spec; `MIGRATIONS[v]` upgrade steps run before the merge.
- The loader (`loadZone`) returns the RESOLVED zone; existing readers keep their shapes (`zone.looks`, `zone.kit`, `zone.spawns`) as views of it, so nothing downstream changes in A1.

## Donor read (shape only; EQEmu and rathena are GPL, nothing copied)
EQEmu `zone` table (one row per zone): `short_name/long_name`, `safe_x/y/z/heading` (respawn), `graveyard_id`, `min_level/max_level`, `maxclients`, `ztype`, `zone_exp_multiplier`, `walkspeed`, `time_type`, fog colour+clip per weather state + `fog_density`, `sky`, `skylock`, `castoutdoor`, `canbind/cancombat/canlevitate`, `hotzone`, `insttype`, `rain_*/snow_*` chance+duration, `gravity`, `fast_regen_*`, `npc_max_aggro_dist`, `lava_damage`, `idle_when_empty`, `shard_at_player_count`, `underworld` (kill plane). `zone_points`: exits with source position+size and `target_zone/x/y/z/heading`. `spawn2` (position, `respawntime`, `variance`, path grid) → `spawngroup` (`spawn_limit`, bounding box, `delay`, `despawn`) → `spawnentry` (npc, `chance`, `min_time/max_time`): a camp is a group of weighted entries at a position. `ground_spawns` (gatherables with respawn), `object` (props), `doors` (`opentype`, `lockpick`, `keyitem`, `dest_zone`+dest position), `grid` (patrol paths). rathena: `mapflag` lines per map (`nopvp`, `pvp`, `notrade`, `noteleport`, `town`, `nosave`): a flag set, not columns. Morrowind/OpenMW cells: exterior cells with `water level`, a `region` (weather chances + sound set) and `ambient/sunlight/fog` colours: the closest analogue of our biome. Taken: field NAMES and the three-level camp shape; not taken: per-weather fog columns (we use weather states by reference), EQ's numeric flags.

## Field groups (path → default; ✓ wired today, ✗ not; owner lane)
**description** — `name` ✓, `region` ✗ (map), `blurb` ✗ (map + hint card), `legend[]` ✗ (legend text ids for named creatures), `icon` ✗, `minimap` ✗. Owner: Web (UI), Characters (legend ids).
**position** — `exits[]` ✓ (place.ts joins; exit position), `entry` ✓ (opener), `respawn` ✗ (town today), `fastTravel[]` ✗, `levelBand` ✓ (`level`), `instance {mode: shared|instanced, cap, seeding}` ✗ default shared / unbounded / off. Owner: World; instance fields Backend.
**look** — `biome` (new), `sky` ✓ (scene env today, global), `timeOfDay` ✓ (global daynight.ts), `fog {colour, density, far}` ✓, `sun {colour, intensity, angle}` ✓, `ambient {sky, ground, intensity}` ✓, `grade` ✗ (colour grade, 16), `exposure` ✓, `ground {tint ✓, material ✗, heightmap ✗}`, `water` ✗, `props {kit ✓, density ✓}`, `landmarks[]` ✓ (placed rows, kit names), `weather {type, chance, duration}` ✗ (ambience.weather exists in world data, unwired in the page), `post` ✗. Owner: World, Characters (kit art).
**sound** — `ambience` ✗ (loop id), `music {explore, combat, boss}` ✗, `footsteps` ✗ (surface), `cries` ✗ (creature cry set; THROATS rows today), `reverb` ✗. Owner: World (sound).
**population** — `camps[] {character, count, at, respawnSeconds, roam}` ✓ (spawns rows + place.ts groups), `rares[] {character, chance, timer}` ✓ (rarity/replaces), `bosses[] {character, arena}` ✗, `townsfolk[]` ✗, `vendors[] {npc, stock rows}` ✗, `questGivers[]` ✗. Owner: Characters (creatures), Backend + Web (vendors, quests).
**interaction** — `gather[] {type, at, respawn}` ✗, `containers[]` ✗, `interactables[] {door|gate|lever, at, effect}` ✗, `safeAreas[]` ✗ (bank, inn: no-combat volumes), `pvp: off|on|opt-in` ✗ default off. Owner: World, Backend.
**play** — `lootOverrides` ✗, `difficulty {mult}` ✗, `reward {mult}` ✗, `warmUp` ✓ DERIVED from camps + the player (never hand-written; warm-plan.ts), `dayNight {on, cycleSeconds}` ✗ (global today). Owner: Backend (loot), World.
**budget** — `triangles`, `textures`, `drawCalls` ✗ per-zone limits the Auditor enforces (a test refuses a heavy zone). Owner: Auditor, World.

## Tests A1 must ship
1. **Add-a-field:** a dummy row added to `FIELDS` with a default → Zone 1, Zone 2 and a generated zone 999 resolve with it, zero edits in any zone folder.
2. **Old zone loads later:** a zone written at `schemaVersion 1` loads after a version-2 step exists.
3. **Wired report:** lists every `wired: false` path (informational test output, pinned count only goes down as fields are wired).
4. **Identity:** Zone 1 and Zone 2 resolved views equal today's `looks / kit / spawns / names / level` byte-for-byte (the existing world hash pins stay).
5. **Unknown field / bad value** is refused with the path.

## Slicing and ETA
**A1** (~1 day): `schema.ts` + `biomes.ts` + resolve + validation + migrations + tests 1-5; Zone 1/2 keep their current files and are read THROUGH the resolver with identical output. **A2** (~half a day after): Zone 1 and 2 folders rewritten to overrides-only on `ash-wastes` (duplicates folded), before/after 375 stills identical. **B** new-zone.mjs takes a biome; **C** `?look=key=value` overlay for the phone.

## Open for Strategy
1. Which look fields are Dom-facing first (sky, fog, grade, music)? They get wired before the rest. 2. Is `instance`/`pvp`/`vendors` a World-owned field with Backend wiring, or does Backend add its own group file? 3. Weather: one `weather` field by reference to a shared weather-state preset (proposed), or per-zone numbers? 4. Terrain heightmap `ref`: a file path in the folder, or a generator seed?
