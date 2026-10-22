// Dungeon 1's roster (Combat, 2026-10-22): which creatures fill each ring of the bowl, as spawn rows. bowl-roster.json is the data (a ring row: landmark, level band, groups); this file is the only code that reads it.
// It checks the table at load (bands ascend without overlap, every character is a known foe, every ring has a landmark the zone has) and compiles each group into spawn rows that carry `roster: true` (Backend's
// settler reads that flag: one spawn instance = one ladder fighter, one character per group; Dom ruled a Dungeon 1 roster kill counts as a ladder win) and a `ring:` id. Leash, roam and spread are NOT stored:
// they are shares of the ring's own width, read through `RingEdges` from the bowl layout's paving pieces, so the ring edges live in one place (World's layout) and never twice. Pure. Donors: EQEmu spawngroup /
// spawn2 (a group of creatures at a spawn point, a respawn time) and ModernUO's champion spawn (levels by ring; docs/specs/origins/modernuo-champion-spawns.md).
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import MANIFEST from './bowl-roster.manifest.json' with { type: 'json' };
import DEFS from './bowl-roster.json' with { type: 'json' };

export type RosterGroup = { readonly id: string; readonly character: string; readonly camps: number; readonly campSize: readonly [number, number] };
export type BowlRing = {
  readonly id: string; readonly order: number; readonly zone: string; readonly landmark: string; readonly levels: readonly [number, number]; readonly respawnSeconds: number;
  readonly aggro: number; readonly roamShare: number; readonly leashShare: number; readonly groups: readonly RosterGroup[];
};
/** A ring's edges in metres from the bowl's centre. The real reader derives them from the bowl layout's paving pieces; a test passes a fixture until that row lands. */
export type RingEdges = (zone: string, landmark: string) => { readonly inner: number; readonly outer: number } | null;
export type BowlKnown = { readonly characters: ReadonlySet<string>; readonly zones: ReadonlySet<string>; readonly landmarks: (zone: string) => ReadonlySet<string> };

/** A spawn row in the zone row's own shape plus the two new fields (`roster`, `ring`). `camps` camps of `campSize` creatures each; leash is how far a creature may be pulled from its camp before it returns. */
export type RosterSpawn = {
  readonly id: string; readonly zone: string; readonly character: string; readonly level: readonly [number, number]; readonly respawnSeconds: number; readonly roster: true; readonly ring: string;
  readonly behaviour: { readonly aggro: number; readonly roam: number; readonly spread: number; readonly pull: 0; readonly leash: number; readonly campSize: readonly [number, number]; readonly camps: number };
};

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
const pair = (v: unknown): v is readonly [number, number] => Array.isArray(v) && v.length === 2 && isInt(v[0]) && isInt(v[1]) && v[0] <= v[1];

/** The rings of a table, checked, in `order`. Throws with the ring's id on the first problem. */
export function loadBowlRings(known: BowlKnown, raw: { rings?: unknown } = DEFS): readonly BowlRing[] {
  const table = tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'bowl-roster.json');
  loadRegistry([table]);
  const rings = (table.rows as unknown as BowlRing[]).slice().sort((a, b) => a.order - b.order);
  let prevHi = 0;
  for (const r of rings) {
    const at = `bowl-roster "${r.id}"`;
    if (!pair(r.levels) || r.levels[0] < 1) throw Error(`${at}: levels must be [lo, hi] whole numbers, lo >= 1`);
    if (r.levels[0] <= prevHi) throw Error(`${at}: levels ${r.levels[0]}-${r.levels[1]} overlap the ring before it (its band ends at ${prevHi}); bands ascend from the outer ring in`);
    prevHi = r.levels[1];
    if (!known.zones.has(r.zone)) throw Error(`${at}: ${r.zone} is not a zone`);
    if (!known.landmarks(r.zone).has(r.landmark)) throw Error(`${at}: zone ${r.zone} has no landmark ${r.landmark}`);
    if (!(r.respawnSeconds > 0)) throw Error(`${at}: respawnSeconds must be positive`);
    if (!(r.aggro > 0)) throw Error(`${at}: aggro must be positive (the bowl's creatures notice the hero like every NPC)`);
    for (const k of ['roamShare', 'leashShare'] as const) if (!(r[k] > 0 && r[k] <= 1)) throw Error(`${at}: ${k} must be in (0, 1]`);
    if (!Array.isArray(r.groups) || r.groups.length === 0) throw Error(`${at}: a ring needs at least one group`);
    const seen = new Set<string>();
    for (const g of r.groups) {
      if (seen.has(g.id)) throw Error(`${at}: group ${g.id} twice`);
      seen.add(g.id);
      if (!known.characters.has(g.character)) throw Error(`${at}: group ${g.id}: ${g.character} is not a known creature`);
      if (!isInt(g.camps) || g.camps < 1) throw Error(`${at}: group ${g.id}: camps must be a whole number >= 1`);
      if (!pair(g.campSize) || g.campSize[0] < 1) throw Error(`${at}: group ${g.id}: campSize must be [min, max], min >= 1`);
    }
  }
  const groupIds = rings.flatMap((r) => r.groups.map((g) => `${r.id}-${g.id}`));
  if (new Set(groupIds).size !== groupIds.length) throw Error('bowl-roster: a ring-group id repeats');
  return rings;
}

const to1 = (n: number): number => Math.round(n * 10) / 10;

/** Every ring's groups as spawn rows. The ring's width (outer - inner edge) sets the camps' spread, the roam and the leash by the ring's shares; a ring whose edges the layout cannot give is an error, never a guess. */
export function rosterSpawns(rings: readonly BowlRing[], edges: RingEdges): readonly RosterSpawn[] {
  return rings.flatMap((r) => {
    const e = edges(r.zone, r.landmark);
    if (!e) throw Error(`bowl-roster "${r.id}": the layout has no edges for ${r.landmark} in zone ${r.zone}`);
    const width = e.outer - e.inner;
    if (!(width > 0)) throw Error(`bowl-roster "${r.id}": ${r.landmark} has no width (inner ${e.inner}, outer ${e.outer})`);
    return r.groups.map((g): RosterSpawn => ({
      id: `d1-${r.id}-${g.id}`, zone: r.zone, character: g.character, level: r.levels, respawnSeconds: r.respawnSeconds, roster: true, ring: r.id,
      behaviour: { aggro: r.aggro, roam: to1(width * r.roamShare), spread: to1(width), pull: 0, leash: to1(width * r.leashShare), campSize: g.campSize, camps: g.camps },
    }));
  });
}

/** The ring a point stands in, or null (the safe yard, outside the bowl). Used by the tests and by whoever places a camp: a camp's centre must sit inside its ring. */
export const ringAt = (rings: readonly BowlRing[], edges: RingEdges, dist: number): string | null =>
  rings.find((r) => { const e = edges(r.zone, r.landmark); return !!e && dist >= e.inner && dist < e.outer; })?.id ?? null;
