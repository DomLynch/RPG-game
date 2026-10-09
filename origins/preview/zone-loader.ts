// The zone loader (zone-runtime step 1, docs/specs/zone-runtime.md): the ONE place that reads a zone's data package (origins/zones/<id>/) and checks it before anything uses it. Callers get a validated Zone
// and never import origins/zones/** themselves (zone-loader.test.ts fails if they do). Pure: no three.js, no DOM, so the server may read the same rows. Only Zone 1 exists; a second zone is a second package
// and a line in PACKAGES.
import type { MobRow } from '../mobs/row.ts';
import type { Look } from './look.ts';
import zone1 from '../zones/zone1/zone.ts';
import spawns1 from '../zones/zone1/spawns.ts';
import kit1 from '../zones/zone1/kit.ts';
import looks1 from '../zones/zone1/look.ts';

export type KitKind = { nodes: readonly string[]; per: number; r: number; solid: number; scale: readonly [number, number] };
export type Zone = {
  id: string; level: number;
  spawns: { openers: Readonly<Record<string, string>>; rows: readonly MobRow[] };
  kit: { url: string; nodes: readonly string[]; landmarks: readonly string[]; kinds: readonly KitKind[] };
  looks: Readonly<Record<string, Look>>;
};
const PACKAGES: Record<string, Zone> = { '1': { ...zone1, spawns: spawns1, kit: kit1, looks: looks1 } };

const HEX = /^#[0-9a-f]{6}$/i;
// What a zone package must satisfy before it is used. Returns the problems (empty = valid); loadZone throws on any. The row-by-row mob rules (sources, loot, look) stay in mobs/row.ts validateRows, run by its tests.
export function zoneProblems(z: Zone): string[] {
  const bad: string[] = [], ids = new Set<string>();
  for (const r of z.spawns.rows) {
    if (ids.has(r.id)) bad.push(`duplicate row ${r.id}`); ids.add(r.id);
    if (r.level[0] !== z.level || r.level[1] !== z.level + 1) bad.push(`${r.id}: level ${r.level.join('-')} is not the zone rule ${z.level}-${z.level + 1}`);
  }
  for (const [zoneId, rowId] of Object.entries(z.spawns.openers)) if (!ids.has(rowId)) bad.push(`opener for ${zoneId} names ${rowId}, which is not a row`);
  const nodes = new Set(z.kit.nodes), landmarks = new Set(z.kit.landmarks);
  if (!z.kit.url.startsWith('/world/kit/')) bad.push(`kit url ${z.kit.url}`);
  for (const k of z.kit.kinds) {
    for (const n of k.nodes) if (!nodes.has(n)) bad.push(`kit kind uses ${n}, which is not a kit node`);
    if (!(k.per > 0 && k.r > 0 && k.solid >= 0 && k.scale[0] > 0 && k.scale[1] >= k.scale[0])) bad.push(`kit kind ${k.nodes[0]}: bad numbers`);
  }
  for (const n of landmarks) if (nodes.has(n)) bad.push(`${n} is both a node and a landmark`);
  for (const [id, l] of Object.entries(z.looks)) {
    for (const hex of [l.fog, l.hemiSky, l.hemiGround, l.sunColor]) if (!HEX.test(hex)) bad.push(`look ${id}: ${hex} is not #rrggbb`);
    if (!(l.fogDensity > 0 && l.fogDensity < 0.1 && l.sunIntensity > 0 && l.exposure > 0.5 && l.exposure < 2.5)) bad.push(`look ${id}: a number is out of range`);
  }
  return bad;
}

const loaded = new Map<string, Zone>();
export function loadZone(id: string = '1'): Zone {
  const hit = loaded.get(id); if (hit) return hit;
  const z = PACKAGES[id]; if (!z) throw new Error(`no zone ${id}`);
  const bad = zoneProblems(z); if (bad.length) throw new Error(`zone ${id} is invalid: ${bad.join('; ')}`);
  loaded.set(id, z); return z;
}
