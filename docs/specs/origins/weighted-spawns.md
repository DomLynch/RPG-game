# Spec (proposal): weighted spawn entries and a named camp boss

Zone sandbox, 2026-10-16. Status: PROPOSAL, docs only, no code. Strategy ruled (2026-10-16): yes to weighted entries (R1), yes to a named camp boss within the zone rule (R2). Build split: this spec = the Zone sandbox; World carries the rows + loader + WSV bump; Combat reviews the sim side; Lead routes. Dom's pick for the goblin zone: Cave Troll (boss) and Giant Salamander (camp creature), first pass only.

**Donor.** EQEmu `spawnentry.chance` (a spawn group lists npcs, each with a `chance` out of the group's total; the group rolls one npc per spawn, `spawn_limit` caps a type); Flare engine enemy-category entries with a rarity weight (6/3/1 by repetition); ModernUO spawner `entries[{name, maxCount, probability}]`. Shape only; GPL sources are not copied.

## Today
A spawn group is `place.spawns: [{ id, at, characters: string[] }]` in the zone row (`origins/zones/place.ts` SpawnGroup; read in `origins/region1/content.ts`), and the creature's own row (`spawns.rows`, `MobRow`) holds `behaviour: { roam, spread, pull, campSize }`. A camp is `campSize` creatures, all drawn from that group's `characters` ids, which today are plain ids (usually one).

## Change (the row shape only)
`characters` entries may be a bare id OR `{ "id": "character:cinder-scavenger", "weight": 6 }`. A bare id is weight 1, so every existing row means exactly what it means today (no zone is edited, the world digest changes only where a row opts in).
- The camp rolls each of its `campSize` creatures, in order, from a seeded stream keyed `(zone, group id, creature index)` (its own stream, like the sandbox's recipe streams: adding a group never reshuffles another). The roll picks an entry in proportion to its weight.
- Optional per entry `max` (EQEmu spawn_limit): at most that many of this id in one camp (rare creatures, bosses).
- Respawn: unchanged (`respawnSeconds` is on the creature's row); a respawned creature rerolls its slot.
- Validation (loader, through the shared registry): ids exist as creature rows, weights are numbers > 0, `max` whole numbers >= 1, at least one entry has no `max` or `max >= campSize`.

## The named camp boss (Strategy R2)
A boss is not a new mechanism: it is a creature row with `named: true`, a group with ONE entry and `campSize 1`, placed at the camp's landmark; a `mobLooks` scale row sizes it; it uses one existing boss special. Zone rule: level N creatures in Zone N, so the Zone 1 boss is level 3 (top of the band), one per zone. Sketch for Zone 1: group `goblin-camp-boss` at the camp landmark, `characters: ["character:cave-troll"]`; creature row `character:cave-troll` (`role: beast`, `level: [3, 3]`, `behaviour: { roam: 2, spread: 4, pull: 0, campSize: [1, 1] }`, a boss special id from the 30 existing boss specials, `named: true`), `mobLooks.looks["character:cave-troll"]` with `scale` (3-4x a goblin per Dom's text) and the troll's body id once Characters ships it. Camp creatures: the Giant Salamander as a weighted entry beside the goblins (e.g. goblin 6, salamander 2, with `max: 1`).

## Sim impact (why this is not a look change)
Which creatures stand in the shared world is sim-visible: the world digest and `WORLD_SIM_VERSION` bump; Backend (zone keys), Combat (boss special, attack style) and World (rows, loader) are all touched; tests must show red then green on: bare ids unchanged (golden digest of Zones 1-4), weights respected over many seeds (chi-square or exact counts on a fixed seed table), `max` honoured, the boss row loads and stands at the landmark. No client change is needed except the creature's body (Characters & Art) and its `mobLooks` row.

## Not in this spec
The creature art (briefs: `docs/briefs/goblin-zone-creatures.md`, `docs/briefs/goblin-camp-props.md`), fight rules and the boss special's numbers (Combat), the GPU spend (Dom and Lead), the Warg, Giant Spider and Cave Drake (later passes).
