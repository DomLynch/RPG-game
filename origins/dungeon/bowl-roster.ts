// Dungeon 1's roster (Combat, 2026-10-22): which creatures fill each ring of the bowl, as spawn rows. bowl-roster.json is the data (a ring row: landmark, level band, groups); this file is the only code that reads it.
// It checks the table at load (bands ascend without overlap, every character is a known foe, every ring has a landmark the zone has) and compiles each group into spawn rows that carry `roster: true` (Backend's
// settler reads that flag: one spawn instance = one ladder fighter, one character per group; Dom ruled a Dungeon 1 roster kill counts as a ladder win) and a `ring:` id. Leash, roam and spread are NOT stored:
// they are shares of the ring's own width, read through `RingEdges` from the bowl layout's paving pieces, so the ring edges live in one place (World's layout) and never twice. Pure. Donors: EQEmu spawngroup /
// spawn2 (a group of creatures at a spawn point, a respawn time) and ModernUO's champion spawn (levels by ring; docs/specs/origins/modernuo-champion-spawns.md).
import { loadRegistry, tableFromFile, type Manifest, type MobRow } from '../../src/core/server.ts';
import MANIFEST from './bowl-roster.manifest.json' with { type: 'json' };
import DEFS from './bowl-roster.json' with { type: 'json' };
import { ROTATION_RULES, type RotationRule } from './legend-at.ts';   // importless: the closed list of rotation rules

/** A creature of a ring. In a FIXED ring (no `rotation`) it carries its own `camps`: that many camps of it stand for life. In a ROTATING ring it is a member of the ring's pool and carries no `camps` (the ring's `camps` count the camps). */
export type RosterGroup = { readonly id: string; readonly character: string; readonly camps?: number; readonly campSize: readonly [number, number] };
export type BowlRing = {
  readonly id: string; readonly order: number; readonly zone: string; readonly landmark: string; readonly levels: readonly [number, number]; readonly respawnSeconds: number;
  readonly aggroShare: number; readonly spreadShare: number; readonly roamShare: number; readonly leashShare: number; readonly groups: readonly RosterGroup[];
  /** ROTATING ring (docs/specs/origins/dungeon-legend-rotation.md): `rotation` names the rule (origins/dungeon/legend-at.ts) and `camps` is how many camps the ring has; every group is a member of the pool each camp walks, one per respawn generation. Both absent = a fixed ring. */
  readonly rotation?: RotationRule; readonly camps?: number;
};
/** A ring's edges in metres from the bowl's centre. The real reader derives them from the bowl layout's paving pieces; a test passes a fixture until that row lands. */
export type RingEdges = (zone: string, landmark: string) => { readonly inner: number; readonly outer: number } | null;
export type BowlKnown = { readonly characters: ReadonlySet<string>; readonly zones: ReadonlySet<string>; readonly landmarks: (zone: string) => ReadonlySet<string> };

/** A zone row's spawn row (`spawns.rows` of origins/zone-rows/zone<id>.row.json: src/core/world/row.ts MobRow) for a roster fighter: the creature's own source, role and loot, the ring's level band, respawn and
 *  behaviour, and `roster: true`. Leash is how far a creature chases before it goes home; roam is at most a third of it (the contract's own rule). Where the camps stand is placement (`place.spawns`), not a row field. */
export type RosterRow = MobRow & { readonly roster: true };
/** What a roster row takes from the creature's own character: who it is (source), how it fights (role), what it drops (loot) and its own world level (a legend's rank), which must sit in its ring's band. */
export type RowBase = Pick<MobRow, 'source' | 'role' | 'loot' | 'level'>;

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
const PAIR = 2;   // a [lo, hi] pair's length: the loader's shape check (exempt: scripts/as-data/allow/origins-dungeon.json)
const HALF = 0.5;   // one half: a camp's spot is the ring's mid-radius, so half the width is the farthest its members may scatter and stay in the ring (exempt: scripts/as-data/allow/origins-dungeon.json)
const ROAM_PER_LEASH = 3;   // the spawn row contract's own rule: roam is at most a third of the leash (src/core/world/row.ts roam-leash) (exempt: scripts/as-data/allow/origins-dungeon.json)
const pair = (v: unknown): v is readonly [number, number] => Array.isArray(v) && v.length === PAIR && isInt(v[0]) && isInt(v[1]) && v[0] <= v[1];

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
    if (!(r.aggroShare > 0)) throw Error(`${at}: aggroShare must be positive (the bowl's creatures notice the hero like every NPC)`);
    if (r.aggroShare + r.spreadShare > HALF + Number.EPSILON) throw Error(`${at}: aggroShare ${r.aggroShare} + spreadShare ${r.spreadShare} is above half the ring: a camp stands at the ring's mid-radius, so its farthest member's notice ring would reach the next ring and a hero there would pull two rings at once`);
    for (const k of ['roamShare', 'leashShare'] as const) if (!(r[k] > 0 && r[k] <= 1)) throw Error(`${at}: ${k} must be in (0, 1]`);
    if (!(r.spreadShare > 0 && r.spreadShare <= HALF)) throw Error(`${at}: spreadShare ${r.spreadShare} must be in (0, ${HALF}]: a camp stands at its ring's mid-radius, so a spread above half the ring's width puts members outside the ring (the bowl wall, or the next ring)`);
    if (r.roamShare * ROAM_PER_LEASH > r.leashShare) throw Error(`${at}: roamShare ${r.roamShare} is above a third of leashShare ${r.leashShare} (the spawn row contract: roam is at most a third of the leash)`);
    if (!Array.isArray(r.groups) || r.groups.length === 0) throw Error(`${at}: a ring needs at least one group`);
    const seen = new Set<string>();
    for (const g of r.groups) {
      if (seen.has(g.id)) throw Error(`${at}: group ${g.id} twice`);
      seen.add(g.id);
      if (!known.characters.has(g.character)) throw Error(`${at}: group ${g.id}: ${g.character} is not a known creature`);
      if (r.rotation === undefined) {
        if (!isInt(g.camps) || g.camps < 1) throw Error(`${at}: group ${g.id}: camps must be a whole number >= 1`);
      } else if (g.camps !== undefined) throw Error(`${at}: group ${g.id}: a rotating ring's groups are pool members and carry no camps (the ring's camps count them)`);
      if (!pair(g.campSize) || g.campSize[0] < 1) throw Error(`${at}: group ${g.id}: campSize must be [min, max], min >= 1`);
    }
    if (r.rotation === undefined) {
      if (r.camps !== undefined) throw Error(`${at}: camps on a ring with no rotation (a fixed ring counts camps per group)`);
    } else {
      if (!(ROTATION_RULES as readonly string[]).includes(r.rotation)) throw Error(`${at}: rotation "${String(r.rotation)}" is not one of ${ROTATION_RULES.join(', ')}`);
      if (!isInt(r.camps) || r.camps < 1) throw Error(`${at}: a rotating ring needs camps, a whole number >= 1`);
      if (new Set(r.groups.map((g) => g.campSize.join('-'))).size > 1) throw Error(`${at}: a rotating ring's groups share one campSize (a camp is sized once, whichever legend stands in it)`);
    }
  }
  const groupIds = rings.flatMap((r) => r.groups.map((g) => `${r.id}-${g.id}`));
  if (new Set(groupIds).size !== groupIds.length) throw Error('bowl-roster: a ring-group id repeats');
  const who = rings.flatMap((r) => r.groups.map((g) => g.character));
  if (new Set(who).size !== who.length) throw Error('bowl-roster: a creature stands in two groups (the zone\'s spawn rows are keyed by character, so one creature has one ring\'s level band)');
  return rings;
}

const TENTH = 10;   // one decimal place when metres are rounded (exempt: scripts/as-data/allow/origins-dungeon.json)
const to1 = (n: number): number => Math.round(n * TENTH) / TENTH;

/** Every ring's groups as the zone's spawn rows (one row per creature, keyed by its character id, which the writer's zoneSpawns finds the `roster` flag by). The ring's width (outer - inner edge) sets the camps'
 *  spread, the roam and the leash by the ring's shares; a ring whose edges the layout cannot give is an error, never a guess; a creature with no base row of its own is an error too. */
export function rosterRows(rings: readonly BowlRing[], edges: RingEdges, base: (character: string) => RowBase | undefined): readonly RosterRow[] {
  return rings.flatMap((r) => {
    const e = edges(r.zone, r.landmark);
    if (!e) throw Error(`bowl-roster "${r.id}": the layout has no edges for ${r.landmark} in zone ${r.zone}`);
    const width = e.outer - e.inner;
    if (!(width > 0)) throw Error(`bowl-roster "${r.id}": ${r.landmark} has no width (inner ${e.inner}, outer ${e.outer})`);
    return r.groups.map((g): RosterRow => {
      const b = base(g.character);
      if (!b) throw Error(`bowl-roster "${r.id}": group ${g.id}: ${g.character} has no row to take its source, role and loot from`);
      if (!(b.level[0] >= r.levels[0] && b.level[1] <= r.levels[1])) throw Error(`bowl-roster "${r.id}": group ${g.id}: ${g.character} is level ${b.level[0]}-${b.level[1]}, outside the ring's band ${r.levels[0]}-${r.levels[1]}`);
      return { id: g.character, source: b.source, role: b.role, loot: b.loot, level: b.level, respawnSeconds: r.respawnSeconds, roster: true,
        behaviour: { aggro: to1(width * r.aggroShare), leash: to1(width * r.leashShare), roam: to1(width * r.roamShare), spread: to1(width * r.spreadShare), pull: 0, campSize: g.campSize } };
    });
  });
}

/** A spawn point of the zone row's `place.spawns`: one camp of one creature, anchored to a landmark of the zone's plan. */
export type RosterPlacement = { readonly id: string; readonly at: string; readonly characters: readonly string[]; readonly rotation?: RotationRule };
/** Every group's camps as `place.spawns` entries. A ring's camps are dealt EVENLY along the ring's spot points in table order (`spotsOf(landmark)`: the zone plan's points that belong to that ring landmark): camp n of
 *  T takes spot floor(n x spots / T), so the camps spread round the annulus and no spot is reused before every spot has a camp. A ring with no spot points is an error: a camp needs a place to stand. */
export function rosterPlacements(rings: readonly BowlRing[], spotsOf: (landmark: string) => readonly string[]): readonly RosterPlacement[] {
  return rings.flatMap((r) => {
    const spots = spotsOf(r.landmark);
    if (spots.length === 0) throw Error(`bowl-roster "${r.id}": the zone has no spot points for ${r.landmark}, so its camps have nowhere to stand`);
    if (r.rotation !== undefined) {   // a rotating ring: `camps` camps, each owning the ring's whole pool (group order = pool order) and dealt over the spots the same way
      const pool = r.groups.map((g) => g.character), camps = r.camps!;
      return Array.from({ length: camps }, (_, k): RosterPlacement => ({ id: `${r.id}-camp-${k}`, at: spots[Math.floor((k * spots.length) / camps)]!, characters: pool, rotation: r.rotation! }));
    }
    const total = r.groups.reduce((sum, g) => sum + g.camps!, 0);
    let dealt = 0;
    return r.groups.flatMap((g) => Array.from({ length: g.camps! }, (_, k): RosterPlacement => ({ id: `${r.id}-${g.id}-${k}`, at: spots[Math.floor((dealt++ * spots.length) / total)]!, characters: [g.character] })));
  });
}

/** The ring a point stands in, or null (the safe yard, outside the bowl). Used by the tests and by whoever places a camp: a camp's centre must sit inside its ring. */
export const ringAt = (rings: readonly BowlRing[], edges: RingEdges, dist: number): string | null =>
  rings.find((r) => { const e = edges(r.zone, r.landmark); return !!e && dist >= e.inner && dist < e.outer; })?.id ?? null;
