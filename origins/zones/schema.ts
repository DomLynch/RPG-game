// THE ZONE FIELD REGISTRY (A1, Strategy-approved docs/specs/origins/zone-schema.md). One row per field; the ZoneSpec a zone file may contain, the defaults, the validator, the wired report and the
// later ?look= overlay all derive from these rows, so a new field costs ONE row here and no zone folder changes. Rules: every field is optional; its default lives HERE or in the biome (biomes.ts), never in a zone;
// no reserved/placeholder fields (a field exists because it means something; empty by default is fine); `wired` says whether anything reads it TODAY (the wired report lists the rest); `owner` is the lane that
// wires it. Donor (shape only, EQEmu zone/spawn tables are GPL, nothing copied): zone, zone_points, spawn2/spawngroup/spawnentry, ground_spawns, doors; rathena mapflags; OpenMW cells.
export const SCHEMA_VERSION = 1;
export type Owner = 'World' | 'Backend' | 'Characters' | 'Web' | 'Combat' | 'Auditor';
export type Group = 'legacy' | 'description' | 'position' | 'look' | 'sound' | 'population' | 'interaction' | 'play' | 'budget';
export type Kind = 'string' | 'number' | 'boolean' | 'color' | 'enum' | 'list' | 'map' | 'point' | 'terrain';
export type Field = { path: string; kind: Kind; default: unknown; group: Group; wired: boolean; owner: Owner; values?: readonly string[]; min?: number; max?: number; nullable?: boolean; donor?: string };

const row = (group: Group, owner: Owner, wired: boolean) => (path: string, kind: Kind, def: unknown, more: Partial<Field> = {}): Field => ({ path, kind, default: def, group, wired, owner, ...more });
const legacy = row('legacy', 'World', true), description = row('description', 'Web', false), position = row('position', 'World', false), look = row('look', 'World', false);
const sound = row('sound', 'World', false), population = row('population', 'Characters', false), interaction = row('interaction', 'World', false), play = row('play', 'Backend', false), budget = row('budget', 'Auditor', false);

export const FIELDS: readonly Field[] = [
  // The facts every zone folder already states (zone.ts, spawns.ts, kit.ts, look.ts, mob-looks.ts, place.ts): wired.
  legacy('id', 'string', ''), legacy('name', 'string', ''), legacy('names', 'map', {}), legacy('world', 'list', []), legacy('level', 'number', 1, { min: 1 }),
  legacy('spawns', 'map', { openers: {}, rows: [] }), legacy('kit', 'map', { url: '', nodes: [], landmarks: [], kinds: [] }), legacy('looks', 'map', {}), legacy('mobLooks', 'map', null as never, { nullable: true }), legacy('place', 'map', null as never, { nullable: true }),
  legacy('biome', 'string', 'ash-wastes'), legacy('schemaVersion', 'number', SCHEMA_VERSION, { min: 1 }),
  // DESCRIPTION (map, hint card, legend)
  description('region', 'string', '', { donor: 'EQEmu zone.long_name / expansion' }), description('blurb', 'string', ''), description('legend', 'list', []), description('icon', 'string', ''), description('minimap', 'string', ''),
  // WORLD POSITION. `exits` and `entry` are carried today by place.ts joins and spawns.openers; these rows are the zone-level overrides.
  position('exits', 'list', [], { donor: 'EQEmu zone_points' }), position('entry', 'point', null, { nullable: true }), position('respawn', 'point', null, { nullable: true, donor: 'EQEmu zone.safe_x/z' }),
  position('fastTravel', 'list', []), position('instance.mode', 'enum', 'shared', { values: ['shared', 'instanced'], owner: 'Backend', donor: 'EQEmu zone.insttype' }),
  position('instance.cap', 'number', 0, { min: 0, owner: 'Backend', donor: 'EQEmu zone.maxclients' }), position('instance.seeding', 'boolean', false, { owner: 'Backend' }),
  // LOOK. Wire first (Strategy): sky/time, fog, grade, ground, prop density.
  look('look.sky', 'string', 'default', { donor: 'EQEmu zone.sky' }), look('look.timeOfDay.follow', 'boolean', true), look('look.timeOfDay.hour', 'number', 12, { min: 0, max: 24 }),
  look('look.fog.colour', 'color', '#c9a47a', { donor: 'EQEmu zone.fog_*' }), look('look.fog.density', 'number', 0.02, { min: 0, max: 1 }), look('look.fog.far', 'number', 107, { min: 10, max: 2000 }),
  look('look.sun.colour', 'color', '#ffb46a'), look('look.sun.intensity', 'number', 5.2, { min: 0, max: 30 }), look('look.sun.pos', 'list', [-24, 12, -15]),
  look('look.ambient.sky', 'color', '#9fb2d4'), look('look.ambient.ground', 'color', '#4a3426'), look('look.ambient.intensity', 'number', 1.25, { min: 0, max: 10 }),
  look('look.exposure', 'number', 1.3, { min: 0.1, max: 4 }), look('look.grade', 'string', 'none'),
  look('look.ground.tint', 'list', [1, 1, 1]), look('look.ground.material', 'string', ''), look('look.terrain', 'terrain', { kind: 'generated', seed: 0, params: {} }),
  look('look.water.level', 'number', null, { nullable: true }), look('look.props.kit', 'string', ''), look('look.props.density', 'number', 1, { min: 0, max: 4 }), look('look.landmarks', 'list', [], { donor: 'EQEmu object' }),
  look('look.weather.preset', 'string', 'clear', { donor: 'EQEmu zone.rain_*/snow_* (by reference)' }), look('look.weather.intensity', 'number', 1, { min: 0, max: 2 }), look('look.weather.probability', 'number', 1, { min: 0, max: 1 }),
  look('look.post', 'list', []),
  // SOUND (World, sound)
  sound('sound.ambience', 'string', ''), sound('sound.music.explore', 'string', ''), sound('sound.music.combat', 'string', ''), sound('sound.music.boss', 'string', ''),
  sound('sound.footsteps', 'string', 'dirt'), sound('sound.cries', 'string', 'default'), sound('sound.reverb', 'string', 'open'),
  // WHAT LIVES THERE. Camps are the spawns rows + place.ts spawn groups today (wired through them); these lists are the zone-level rows for the rest.
  population('camps', 'list', [], { wired: true, donor: 'EQEmu spawn2/spawngroup/spawnentry' }), population('rares', 'list', [], { wired: true }), population('bosses', 'list', []),
  population('townsfolk', 'list', []), population('vendors', 'list', [], { owner: 'Backend' }), population('questGivers', 'list', [], { owner: 'Backend' }),
  // WHAT YOU CAN DO
  interaction('gather', 'list', [], { donor: 'EQEmu ground_spawns' }), interaction('containers', 'list', []), interaction('interactables', 'list', [], { donor: 'EQEmu doors' }),
  interaction('safeAreas', 'list', [], { donor: 'rathena mapflag town/nopvp' }), interaction('pvp', 'enum', 'off', { values: ['off', 'on', 'opt-in'], owner: 'Backend', donor: 'rathena mapflag pvp' }),
  // HOW IT PLAYS (the warm-up list is DERIVED from camps + the player, warm-plan.ts: not a field)
  play('loot.overrides', 'map', {}), play('difficulty.mult', 'number', 1, { min: 0.1, max: 10 }), play('reward.mult', 'number', 1, { min: 0, max: 10, donor: 'EQEmu zone.zone_exp_multiplier' }),
  play('dayNight.on', 'boolean', true, { owner: 'World' }), play('dayNight.cycleSeconds', 'number', 0, { min: 0, owner: 'World' }),
  // BUDGET (0 = no zone limit: the global gate applies)
  budget('budget.triangles', 'number', 0, { min: 0 }), budget('budget.textures', 'number', 0, { min: 0 }), budget('budget.drawCalls', 'number', 0, { min: 0 }),
];
export const byPath = (fields: readonly Field[] = FIELDS): Map<string, Field> => new Map(fields.map((f) => [f.path, f]));
