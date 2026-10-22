// Zone PvP by area (Dungeon slice A, docs/specs/origins/pit-live-zone.md): the zone row's `pvp` (off | on | opt-in) and its `safeAreas` (rect volumes with their own `pvp`) decide whether a player at (x, z) is
// attackable by other players. src/fight/world.ts `attackable` reads the per-fighter `pvp` flag and nothing sets it: `applyPvp` is the setter. Pure data in, booleans out: no three.js, no DOM, no clock, and no
// number of its own (every value is a row field). It has no call site yet: slice B (the Dungeon world builder, then the server verify path once something steps the world) calls applyPvp.
// Donor (shape only, GPL, nothing copied): rathena mapflags (a town/nopvp volume inside a pvp map).

/** One safeAreas entry (zone row `safeAreas`): a rectangle on the ground plane, its own PvP verdict, and whether creatures may spawn inside it. `min` and `max` are the [x, z] corners in the zone's metres. */
export type SafeArea = { id: string; name: string; shape: 'rect'; min: readonly [number, number]; max: readonly [number, number]; pvp: 'off' | 'on'; spawnsAllowed: boolean };
/** The two zone fields this module reads. `pvp` is the zone default (`opt-in` is per-player and is slice F's: here it reads as off). */
export type PvpSpec = { pvp?: string; safeAreas?: readonly SafeArea[] };

const ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const AXES = ['x', 'z'] as const;   // a ground point is one number per axis
const point = (p: unknown): p is readonly [number, number] => Array.isArray(p) && p.length === AXES.length && p.every((n) => typeof n === 'number' && Number.isFinite(n));

/** What is wrong with a zone's safeAreas rows (empty = fine): shape, corner order, a repeated id, an unknown pvp value, a non-boolean spawnsAllowed. The loader (zoneProblems) calls it. */
export function safeAreaProblems(areas: unknown): string[] {
  if (areas === undefined) return [];
  if (!Array.isArray(areas)) return ['safeAreas is a list'];
  const bad: string[] = [], seen = new Set<string>();
  for (const [i, a] of (areas as Record<string, unknown>[]).entries()) {
    const at = `safeAreas[${i}]`;
    if (a === null || typeof a !== 'object') { bad.push(`${at}: an object {id, name, shape, min, max, pvp, spawnsAllowed}`); continue; }
    if (typeof a.id !== 'string' || !ID.test(a.id)) bad.push(`${at}: id ${JSON.stringify(a.id)} is not a lowercase id`);
    else if (seen.has(a.id)) bad.push(`${at}: id ${a.id} is repeated`); else seen.add(a.id);
    if (typeof a.name !== 'string' || !a.name.trim()) bad.push(`${at}: a display name`);
    if (a.shape !== 'rect') bad.push(`${at}: shape ${JSON.stringify(a.shape)} is not "rect"`);
    if (!point(a.min) || !point(a.max)) bad.push(`${at}: min and max are [x, z] numbers`);
    else if (a.min[0] > a.max[0] || a.min[1] > a.max[1]) bad.push(`${at}: min is not at or below max`);
    if (a.pvp !== 'off' && a.pvp !== 'on') bad.push(`${at}: pvp ${JSON.stringify(a.pvp)} is not "off" or "on"`);
    if (typeof a.spawnsAllowed !== 'boolean') bad.push(`${at}: spawnsAllowed is true or false`);
  }
  return bad;
}

/** The areas that contain (x, z). The border counts as inside (min <= p <= max on both axes). */
export const areasAt = (areas: readonly SafeArea[] | undefined, x: number, z: number): SafeArea[] =>
  (areas ?? []).filter((a) => x >= a.min[0] && x <= a.max[0] && z >= a.min[1] && z <= a.max[1]);

/**
 * May other players attack a player standing at (x, z) in this zone? `safe` = the world zone is a town (origins/world `rules.safe`): always false, whatever the rows say. Otherwise the containing
 * areas decide, the most restrictive winning (one `off` is enough); outside every area the zone default decides (`on` = true; `off` and `opt-in` = false, opt-in being a per-player flag later).
 */
export function pvpAt(spec: PvpSpec, x: number, z: number, safe = false): boolean {
  if (safe) return false;
  const inside = areasAt(spec.safeAreas, x, z);
  if (inside.length > 0) return inside.every((a) => a.pvp === 'on');
  return spec.pvp === 'on';
}

/** The fighters with `pvp` set from where each PLAYER stands (creatures are returned as they are). Never mutates its input. `safeAt(x, z)` says whether that spot is a town (default: nowhere). */
export function applyPvp<F extends { side: string; x: number; z: number; pvp: boolean }>(fighters: readonly F[], spec: PvpSpec, safeAt: (x: number, z: number) => boolean = () => false): F[] {
  return fighters.map((f) => {
    if (f.side !== 'player') return f;
    const on = pvpAt(spec, f.x, f.z, safeAt(f.x, f.z));
    return on === f.pvp ? f : { ...f, pvp: on };
  });
}
