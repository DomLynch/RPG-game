// Zone placement is DATA in the zone's folder (origins/zones/zone<N>/place.ts), and Region 1 names no zone of its own (Dom 2026-10-09: scalable zone creation without micromanagement).
// Fails if region1/world.ts or content.ts names anything a place introduces; a throwaway zone3 folder reaches the map, the waypoints, the spawn groups and the registry with ZERO edits outside it.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { registrySource, ZONES_DIR } from '../scripts/gen-zones.mjs';
import { applyZones, placeNames, placedSpawns, placedWaypoints, placesInOrder, type Place } from '../origins/zones/place.ts';
import { zonePlaces } from '../origins/zones/loader.ts';
import { REGION1_WORLD, FRONTIER_REGION } from '../origins/region1/world.ts';

const region1Sources = ['origins/region1/world.ts', 'origins/region1/content.ts'].map((f) => [f, readFileSync(f, 'utf8')] as const);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('region1 names nothing a zone place introduces (zones, landmarks, links, waypoints, spawn groups)', () => {
  const names = zonePlaces().flatMap(placeNames);
  assert.ok(names.includes('ash-reach') && names.includes('reach-turn') && names.includes('reach-wolves'), 'Zone 2 brings its own names');
  for (const [file, src] of region1Sources) for (const n of names) assert.ok(!new RegExp(`['"\`]${esc(n)}['"\`]`).test(src), `${file} names ${n}: it belongs in the zone's place.ts`);
});

test('the real map still has the Ash Reach where it was: its zone, the track from the east road (before the crossroads) and the road back', () => {
  const zones = (REGION1_WORLD.regions as unknown as Record<string, { zones: Record<string, { layout: Record<string, unknown>; connections?: Record<string, { to: string }> }> }>)[FRONTIER_REGION]!.zones;
  assert.ok(zones['ash-reach'], 'the zone'); assert.equal(zones['ash-reach']!.connections!.road!.to, 'east-road');
  const keys = Object.keys(zones['east-road']!.layout);
  assert.ok(keys.indexOf('reach-turn') >= 0 && keys.indexOf('reach-turn') === keys.indexOf('crossroads') - 1, 'reach-turn sits just before crossroads, as before');
  assert.equal(zones['east-road']!.connections!.reach!.to, 'ash-reach');
});

test('a throwaway zone3 folder appears on the map, in the waypoints and spawns, and in the registry with zero edits outside its folder', async () => {
  const scratch = mkdtempSync(`${tmpdir()}/zones3-`);
  try {
    cpSync(`${ZONES_DIR}zone2`, `${scratch}/zone3`, { recursive: true });
    const swap = (f: string, pairs: [string | RegExp, string][]) => { let s = readFileSync(`${scratch}/zone3/${f}`, 'utf8'); for (const [a, b] of pairs) s = s.replace(a, b); writeFileSync(`${scratch}/zone3/${f}`, s); };
    swap('zone.ts', [["id: '2', level: 2, name: 'The Ash Reach', names: { 'ash-reach': 'The Ash Reach' }", "id: '3', level: 3, name: 'The Salt Flats', names: { 'salt-flats': 'The Salt Flats' }"], ["world: ['ash-reach']", "world: ['salt-flats']"]]);
    swap('place.ts', [[/ash-reach/g, 'salt-flats'], [/reach-/g, 'flats-'], [/'reach'/g, "'flats'"], ['east-road\', landmark', 'east-road\', landmark']]);
    const src = registrySource(`${scratch}/`);
    assert.match(src, /place: place3 \}/);
    writeFileSync(`${scratch}/registry.ts`, src);
    const { REGISTRY } = await import(pathToFileURL(`${scratch}/registry.ts`).href) as { REGISTRY: Record<string, { place?: Place }> };
    const places = placesInOrder(REGISTRY);
    assert.equal(places.length, 1);
    const base = { 'east-road': { layout: { milestone: { u: 0.5, v: 0.3, facing: 0 }, crossroads: { u: 0.5, v: 1, facing: 0 } }, connections: { ferry: { to: 'ferry-landing' } } } };
    const zones = applyZones(base, places);
    assert.ok(zones['salt-flats'], 'zone3 is on the map');
    assert.deepEqual(Object.keys((zones['east-road']!.layout as object)), ['milestone', 'flats-turn', 'crossroads'], 'its landmark joins the parent before the crossroads');
    assert.equal((zones['east-road']!.connections as Record<string, { to: string }>).flats!.to, 'salt-flats');
    assert.deepEqual(placedWaypoints(places), ['flats-turn', 'flats-gate', 'flats-cairn', 'flats-ruin']);
    assert.deepEqual(placedSpawns(places).map((s) => s.id), ['flats-wolves', 'flats-scavengers']);
    assert.throws(() => applyZones({}, places), /no zone east-road/, 'a join to a zone that is not there is an error');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});
