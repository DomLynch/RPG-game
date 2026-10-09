// The zone loader (zone-runtime step 1, docs/specs/zone-runtime.md): the ONE place that reads a zone's data package (origins/zones/<id>/) and checks it before anything uses it. Callers get a validated Zone
// and never import origins/zones/** themselves (loader.test.ts fails if they do). Pure: no three.js, no DOM, so the server may read the same rows. Only Zone 1 exists; a second zone is a second package
// and a line in PACKAGES.
import type { MobRow } from '../mobs/row.ts';
import type { Look } from '../preview/look.ts';
import type { MobLook, MobSpread } from '../preview/mob-looks.ts';
import { ROSTER } from '../../src/roster.ts';
import zone1 from './zone1/zone.ts';
import spawns1 from './zone1/spawns.ts';
import kit1 from './zone1/kit.ts';
import looks1 from './zone1/look.ts';
import zone2 from './zone2/zone.ts';
import spawns2 from './zone2/spawns.ts';
import kit2 from './zone2/kit.ts';
import looks2 from './zone2/look.ts';
import mobLooks2 from './zone2/mob-looks.ts';

export type KitKind = { nodes: readonly string[]; per: number; r: number; solid: number; scale: readonly [number, number] };
export type Zone = {
  id: string; level: number;
  world: readonly string[];   // the world-data zones (origins/region1/world.ts) this zone's page walks
  spawns: { openers: Readonly<Record<string, string>>; rows: readonly MobRow[] };
  kit: { url: string; nodes: readonly string[]; landmarks: readonly string[]; kinds: readonly KitKind[] };
  looks: Readonly<Record<string, Look>>;
  mobLooks?: { looks: Readonly<Record<string, MobLook>>; spread: Readonly<Record<string, MobSpread>> };   // how this zone's own creatures are dressed, by character id; mobLook()/variantLook() read it before the central MOB_LOOKS (a zone with none dresses nothing differently)
};
const PACKAGES: Record<string, Zone> = {
  '1': { ...zone1, spawns: spawns1, kit: kit1, looks: looks1 },
  '2': { ...zone2, spawns: spawns2, kit: kit2, looks: looks2, mobLooks: mobLooks2 },
};

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
  const unit = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1, rgb = (n: number) => Number.isInteger(n) && n >= 0 && n <= 0xffffff;
  for (const [id, l] of Object.entries(z.mobLooks?.looks ?? {})) {
    if (!Object.hasOwn(ROSTER, l.opponent)) bad.push(`mob look ${id}: ${l.opponent} is not a roster body`);
    if (!rgb(l.tint)) bad.push(`mob look ${id}: tint is not a 0xrrggbb number`);
    if (!(l.scale >= 0.3 && l.scale <= 3)) bad.push(`mob look ${id}: scale ${l.scale} is out of range (0.3-3)`);
    if (!unit(l.dressing.soot) || !unit(l.dressing.burnt)) bad.push(`mob look ${id}: soot/burnt must be 0..1`);
  }
  for (const [id, sp] of Object.entries(z.mobLooks?.spread ?? {})) {
    if (!z.mobLooks!.looks[id]) bad.push(`mob spread ${id} has no mob look`);
    if (!sp.tints.length || !sp.tints.every(rgb)) bad.push(`mob spread ${id}: tints must be 0xrrggbb numbers`);
    if (!(sp.scale >= 0 && sp.scale <= 0.5) || !unit(sp.soot) || !unit(sp.burnt)) bad.push(`mob spread ${id}: a number is out of range`);
  }
  return bad;
}

export const zoneIds = (): string[] => Object.keys(PACKAGES);

// Which zone a page address names: /zone/<id>/ or ?zone=<id> (the path wins), else Zone 1 (/zone1/ and every old link). Pure, so the server and the tests read it the same way. An id that is not a zone is returned as given; loadZone then says so.
export function zoneFromAddress(pathname: string, search: string): string {
  return /^\/zone\/([^/]+)\/?/.exec(pathname)?.[1] ?? new URLSearchParams(search).get('zone') ?? '1';
}
// The page's zone: every loadZone() with no id reads this. No page (the server, the tests) means Zone 1.
export const pageZoneId = (): string => typeof location === 'undefined' ? '1' : zoneFromAddress(location.pathname, location.search);

const loaded = new Map<string, Zone>();
export function loadZone(id: string = pageZoneId()): Zone {
  const hit = loaded.get(id); if (hit) return hit;
  const z = PACKAGES[id]; if (!z) throw new Error(`no zone ${id}`);
  const bad = zoneProblems(z); if (bad.length) throw new Error(`zone ${id} is invalid: ${bad.join('; ')}`);
  loaded.set(id, z); return z;
}
