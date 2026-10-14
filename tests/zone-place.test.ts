// Zone placement is DATA in the zone's row (origins/zone-rows/zone<N>.row.json, its `place`), and Region 1 names no zone of its own (Dom 2026-10-09: scalable zone creation without micromanagement).
// Fails if region1/world.ts or content.ts names anything a place introduces; a throwaway zone3 row reaches the map, the waypoints, the spawn groups and the registry with ZERO edits outside it.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { registrySource, ROWS_DIR, ZONES_DIR } from '../scripts/gen-zones.mjs';
import { applyZones, placeNames, placedSpawns, placedWaypoints, placesInOrder, type Place } from '../origins/zones/place.ts';
import { loadZone, zonePlaces } from '../origins/zones/loader.ts';
import { REGION1_WORLD, FRONTIER_REGION } from '../origins/region1/world.ts';

const region1Sources = ['origins/region1/world.ts', 'origins/region1/content.ts'].map((f) => [f, readFileSync(f, 'utf8')] as const);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('region1 names nothing a zone place introduces (zones, landmarks, links, waypoints, spawn groups)', () => {
  const names = zonePlaces().slice(1).flatMap(placeNames);   // [0] is Zone 1: the encounters, towns and loot in content.ts still name its landmarks
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

test('a throwaway zone3 row appears on the map, in the waypoints and spawns, and in the registry with zero edits outside it', async () => {
  const scratch = mkdtempSync(`${tmpdir()}/zones3-`);
  try {
    // zone3's row is written whole from Zone 2's LOADED data, not edited as text.
    const place = JSON.parse(JSON.stringify(loadZone('2').place).replace(/ash-reach/g, 'salt-flats').replace(/reach-/g, 'flats-').replace(/"reach"/g, '"flats"'));
    const two = JSON.parse(readFileSync(`${ROWS_DIR}zone2.row.json`, 'utf8'));
    writeFileSync(`${scratch}/zone3.row.json`, JSON.stringify({ name: 'The Salt Flats', names: { 'salt-flats': 'The Salt Flats' }, world: ['salt-flats'], kit: two.kit, looks: two.looks, place }));
    const src = registrySource(`${scratch}/`);
    assert.match(src, /zoneFromRow\(3, row3\)/);
    writeFileSync(`${scratch}/registry.ts`, src.replace("'./from-row.ts'", `'${pathToFileURL(`${ZONES_DIR}from-row.ts`).href}'`).replaceAll("'../zone-rows/", "'./"));
    const { REGISTRY } = await import(pathToFileURL(`${scratch}/registry.ts`).href) as { REGISTRY: Record<string, { place?: Place }> };
    const places = placesInOrder(REGISTRY);
    assert.equal(places.length, 1);
    const base = { 'east-road': { layout: { milestone: { u: 0.5, v: 0.3, facing: 0 }, crossroads: { u: 0.5, v: 1, facing: 0 } }, connections: { ferry: { to: 'ferry-landing' } } } };
    const zones = applyZones(base, places);
    assert.ok(zones['salt-flats'], 'zone3 is on the map');
    assert.deepEqual(Object.keys((zones['east-road']!.layout as object)), ['milestone', 'flats-turn', 'crossroads'], 'its landmark joins the parent before the crossroads');
    assert.equal((zones['east-road']!.connections as Record<string, { to: string }>).flats!.to, 'salt-flats');
    assert.deepEqual(placedWaypoints(places), ['flats-turn', 'flats-gate', 'flats-cairn', 'flats-ruin']);
    assert.deepEqual(placedSpawns(places).map((s) => s.id), ['flats-wolves', 'flats-pack-a', 'flats-pack-b', 'flats-scavengers']);
    assert.throws(() => applyZones({}, places), /no zone east-road/, 'a join to a zone that is not there is an error');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});
