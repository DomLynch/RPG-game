// The zone loader (zone-runtime step 1, docs/specs/zone-runtime.md): the ONE place that reads a zone's data package (origins/zones/<id>/) and checks it before anything uses it. Callers get a validated Zone
// and never import origins/zones/** themselves (loader.test.ts fails if they do). Pure: no three.js, no DOM, so the server may read the same rows. A zone is a data row (origins/zone-rows/zone<N>.row.json)
// and nothing else: registry.ts is generated from the rows (scripts/gen-zones.mjs) and from-row.ts turns each into a Zone.
import type { MobRow } from '../../src/core/server.ts';
import type { Look } from '../preview/look.ts';
import type { MobLookRow, MobSpread } from '../preview/mob-looks.ts';
import { ROSTER } from '../../src/fight/server.ts';
import { duplicateKeys, describeDuplicates } from '../../scripts/lib/json-dup-keys.mjs';
import { REGISTRY } from './registry.ts';
import { placesInOrder, spawnIds, spawnProblems, type Place } from './place.ts';
import { resolveZone } from './resolve.ts';
import { stageRule } from '../world/stage-rules.ts';
import { loadoutRow } from '../world/loadouts-rules.ts';
import type { Spec } from './biomes.ts';

export type KitKind = { nodes: readonly string[]; per: number; r: number; solid: number; scale: readonly [number, number] };
export type Zone = {
  id: string; level: number;
  defaultKind?: string;       // the roster body a creature whose character form names none stands as (a row column, schema default 'goblin', checked as a roster body)
  name: string;               // the zone's display name: the tab title and the HUD read it (Zone 1 = the Cinder Fields it opens in)
  names: Readonly<Record<string, string>>;   // display names of its world zones, by world-zone id (zone.world)
  world: readonly string[];   // the world-data zones (origins/region1/world.ts) this zone's page walks
  spawns: { openers: Readonly<Record<string, string>>; rows: readonly MobRow[] };
  kit: { url: string; nodes: readonly string[]; landmarks: readonly string[]; kinds: readonly KitKind[] };
  looks: Readonly<Record<string, Look>>;
  fields?: Readonly<Record<string, unknown>>;   // the same resolved values, flat by path ('look.fog.density'); `set` is the paths a biome or this zone set (readers act on those only)
  set?: readonly string[];
  resolved?: Spec;   // every schema field resolved (defaults < biome < this zone, schema.ts + resolve.ts), nested; set by loadZone. The views above stay as they were
  place?: Place;   // where it stands on the Region 1 map (place.ts); region1 reads it from the registry
  unlisted?: boolean;   // a test or work-in-progress zone (schema `unlisted`): only its own page sees it; zoneIds(), zonePlaces() and the server never list it, so a merged branch cannot put it on the map
  mobLooks?: { looks: Readonly<Record<string, MobLookRow>>; spread: Readonly<Record<string, MobSpread>> };   // how this zone's own creatures are dressed, by character id; mobLook()/variantLook() read it before the central MOB_LOOKS (a zone with none dresses nothing differently)
};
const PACKAGES: Record<string, Zone> = REGISTRY;
/** Where every zone stands on the Region 1 map, in zone-number order: region1 builds its zones, waypoints and spawn groups from this and names no zone itself (zone<N>/place.ts). */
// A listed zone, or the unlisted zone this page itself opens (a page names its zone by address; the server and the tests have no page, so they never see an unlisted zone).
/** The ids a page (`here` = the zone its address opens; null = no page: the server, the tests) may see: every listed zone, plus `here` itself when it is unlisted. Pure. */
/** Whether a build may open an unlisted zone: ONLY when it was built or run with the explicit opt-in VITE_UNLISTED_ZONES=1. Default off. The live game is the /preview/origins/ bundle (also published at /zone1/), so a base path says nothing about live; only Deploy's sandbox previews for Dom set the flag, never the /zone1/ + /preview/origins/ publish (tests/unlisted-zones-guard.test.ts fails if a publish or deploy script or a .env.production* sets it). Pure on its argument. */
export const unlistedOpens = (env: { VITE_UNLISTED_ZONES?: string } | undefined): boolean => env?.VITE_UNLISTED_ZONES === '1';
const buildEnv = (): { VITE_UNLISTED_ZONES?: string } | undefined => (import.meta as unknown as { env?: { VITE_UNLISTED_ZONES?: string } }).env ?? (typeof process === 'undefined' ? undefined : process.env);
const opensNow = (): boolean => unlistedOpens(buildEnv());   // read per call, so a test can set the flag; the server passes opens=false explicitly and never reads it
export const listedIds = (packages: Readonly<Record<string, { unlisted?: boolean }>>, here: string | null, opens: boolean = opensNow()): string[] => Object.keys(packages).filter((id) => !packages[id]!.unlisted || (opens && id === here));
const here = (): string | null => (typeof location === 'undefined' ? null : zoneFromAddress(location.pathname, location.search));
export const zonePlaces = (): Place[] => { const ids = new Set(listedIds(PACKAGES, here())); return placesInOrder(Object.fromEntries(Object.entries(PACKAGES).filter(([id]) => ids.has(id)))); };

const HEX = /^#[0-9a-f]{6}$/i;
// What a zone package must satisfy before it is used. Returns the problems (empty = valid); loadZone throws on any. The row-by-row mob rules (sources, loot, look) stay in mobs/row.ts validateRows, run by its tests.
export function zoneProblems(z: Zone, known?: ReadonlySet<string>, rowText?: string): string[] {   // `known`: every character id the content names (strings, no union: Dom 2026-10-12); given, a mob look or spread for an id outside it is a problem
  const bad: string[] = rowText === undefined ? [] : describeDuplicates(`zone ${z.id} row`, duplicateKeys(rowText)), ids = new Set<string>();   // rowText: the row's raw JSON when the caller has it: a repeated key is invisible in the parsed Zone (JSON.parse keeps the last), so it is scanned in the text
  if (!z.name.trim()) bad.push('no display name');
  const own: Record<string, unknown> = { ...z };
  delete own.resolved; delete own.fields; delete own.set;   // what loadZone adds, not part of the spec
  bad.push(...resolveZone(z.id, own as unknown as Spec).problems.map((p) => `schema: ${p}`));
  for (const w of z.world) if (!z.names[w]?.trim()) bad.push(`world zone ${w} has no display name`);
  for (const r of z.spawns.rows) {
    if (ids.has(r.id)) bad.push(`duplicate row ${r.id}`); ids.add(r.id);
    const lift = stageRule('namedLevelLift');   // a named camp boss is the zone level + the lift (stage rules row; was the NAMED_LEVEL literal)
    if (r.named ? r.level[0] !== z.level + lift || r.level[1] !== z.level + lift : r.level[0] !== z.level || r.level[1] < z.level || r.level[1] > z.level + 1) bad.push(`${r.id}: level ${r.level.join('-')} is not the zone rule ${r.named ? `${z.level + lift} (a named camp boss is the zone level + ${lift})` : `${z.level}-${z.level + 1}`}`);
  }
  for (const [zoneId, rowId] of Object.entries(z.spawns.openers)) if (!ids.has(rowId)) bad.push(`opener for ${zoneId} names ${rowId}, which is not a row`);
  for (const g of z.place?.spawns ?? []) {   // weighted entries (docs/specs/origins/weighted-spawns.md): the camp is sized by the first entry's row; that every id is a character is the registry's check (region1 load.ts)
    const first = z.spawns.rows.find((r) => r.id === spawnIds(g)[0]);
    bad.push(...spawnProblems(g, first?.behaviour.campSize?.[1] ?? 1));
  }
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
  if (z.defaultKind !== undefined && !Object.hasOwn(ROSTER, z.defaultKind)) bad.push(`defaultKind ${z.defaultKind}: not a roster body`);
  for (const [id, l] of Object.entries(z.mobLooks?.looks ?? {})) {
    if (!Object.hasOwn(ROSTER, l.opponent)) bad.push(`mob look ${id}: ${l.opponent} is not a roster body`);
    if (!rgb(l.tint)) bad.push(`mob look ${id}: tint is not a 0xrrggbb number`);
    if (l.scale !== undefined && !(l.scale >= 0.3 && l.scale <= 6)) bad.push(`mob look ${id}: scale ${l.scale} is out of range (0.3-6)`);
    if (!unit(l.dressing.soot) || !unit(l.dressing.burnt)) bad.push(`mob look ${id}: soot/burnt must be 0..1`);
  }
  if (known) for (const id of [...Object.keys(z.mobLooks?.looks ?? {}), ...Object.keys(z.mobLooks?.spread ?? {})]) if (!known.has(id)) bad.push(`mob look ${id}: no such character (not a spawn row or a region foe)`);
  for (const [id, sp] of Object.entries(z.mobLooks?.spread ?? {})) {
    if (!z.mobLooks!.looks[id]) bad.push(`mob spread ${id} has no mob look`);
    if (!sp.tints.length || !sp.tints.every(rgb)) bad.push(`mob spread ${id}: tints must be 0xrrggbb numbers`);
    if (!(sp.scale >= 0 && sp.scale <= 0.5) || !unit(sp.soot) || !unit(sp.burnt)) bad.push(`mob spread ${id}: a number is out of range`);
    if (sp.loadouts && !(Array.isArray(sp.loadouts) && sp.loadouts.every((l) => loadoutRow(l)))) bad.push(`mob spread ${id}: loadouts is a list of loadout row ids (origins/world/loadouts.json)`);
    const own = z.mobLooks!.looks[id]!; if (own.loadout && !loadoutRow(own.loadout)) bad.push(`mob look ${id}: loadout "${own.loadout}" is not a loadout row`);
  }
  return bad;
}

/** A zone seen as if it were in another biome (`?look=goblin` on Zone 1): its own package resolved with `biome` swapped, plus any `extra` fields set outright. Only look readers use it; the zone itself is untouched. */
export function zoneAsBiome(id: string, biome: string, extra: Record<string, unknown> = {}): Zone {
  const z = PACKAGES[id]; if (!z) throw new Error(`no zone ${id}`);
  const r = resolveZone(id, { ...z, biome } as unknown as Spec);
  return { ...z, fields: { ...r.values, ...extra }, set: [...r.explicit, ...Object.keys(extra)] };
}
export const zoneIds = (opens: boolean = opensNow()): string[] => listedIds(PACKAGES, here(), opens);
/** Every zone row, listed or not: for checks that must validate an unlisted row too (scripts/data-only-check.mjs), never for what a player or the server sees. */
export const allZoneIds = (): string[] => Object.keys(PACKAGES);
/** The zone a page or request names none of (every old link) and the one whose instance ids stay bare: Zone 1, PINNED. The live database keys are bare for Zone 1 specifically, not for "the lowest row" (the keys were written before there were rows), so this is not derived from the registry; a registry without Zone 1 throws at load. The one place a zone id is a value, not a name; callers read this and never write `'1'`. */
export const DEFAULT_ZONE = '1';
if (!zoneIds().includes(DEFAULT_ZONE)) throw new Error(`the zone registry has no zone ${DEFAULT_ZONE}: its live keys are bare`);
/** The prefix of a creature's instance id in this zone: the default zone's ids stay bare (the live rows), every other zone's are `z<id>:` (the server keys a creature by its id alone). */
export const zoneKeyPrefix = (id: string): string => id === DEFAULT_ZONE ? '' : `z${id}:`;
export const zoneNames = (): Record<string, string> => Object.assign({}, ...zoneIds().map((id) => loadZone(id).names));   // every zone's world-zone display names, merged

// Which zone a page address names: /zone/<id>/ or ?zone=<id> (the path wins), else Zone 1 (/zone1/ and every old link). Pure, so the server and the tests read it the same way. An id that is not a zone is returned as given; loadZone then says so.
export function zoneFromAddress(pathname: string, search: string): string {
  return /^\/zone\/([^/]+)\/?/.exec(pathname)?.[1] ?? new URLSearchParams(search).get('zone') ?? DEFAULT_ZONE;
}
// The page's zone: every loadZone() with no id reads this. No page (the server, the tests) means Zone 1.
export const pageZoneId = (): string => typeof location === 'undefined' ? DEFAULT_ZONE : zoneFromAddress(location.pathname, location.search);

const loaded = new Map<string, Zone>();
export function loadZone(id: string = pageZoneId(), opens: boolean = opensNow()): Zone {
  const z = PACKAGES[id]; if (!z || (z.unlisted && !opens)) throw new Error(`no zone ${id}`);   // an unlisted zone without the VITE_UNLISTED_ZONES opt-in is the same "no such place" as an id that is no zone
  const hit = loaded.get(id); if (hit) return hit;
  const bad = zoneProblems(z); if (bad.length) throw new Error(`zone ${id} is invalid: ${bad.join('; ')}`);
  const r = resolveZone(id, z as unknown as Spec), full = { ...z, resolved: r.tree, fields: r.values, set: r.explicit };   // z is a package straight from the registry: it has no `resolved` yet
  loaded.set(id, full); return full;
}
