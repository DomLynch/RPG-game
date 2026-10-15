// Plug and play (Dom 2026-10-09; the row IS the zone, 2026-10-11): a zone is one row file, nothing else. The registry is generated from origins/zone-rows/zone<N>.row.json; a fixture zone 99 row in a scratch
// folder loads with ZERO edits to any file outside it.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { registrySource, ROWS_DIR, ZONES_DIR, zoneRows } from '../scripts/gen-zones.mjs';
import { allZoneIds, DEFAULT_ZONE, loadZone, zoneIds, zoneKeyPrefix, zoneProblems, type Zone } from '../origins/zones/loader.ts';

test('the committed registry is what the zone rows generate (npm run zones writes it)', () => {
  assert.equal(readFileSync(`${ZONES_DIR}registry.ts`, 'utf8'), registrySource(), 'stale registry: run `npm run zones`');
  assert.deepEqual(allZoneIds(), (zoneRows() as { id: string }[]).map((z) => z.id));   // every row (zoneIds() is the listed ones: an unlisted row is off the list, still in the registry)
});

test('every zone names itself and its world zones (the tab title and the HUD read them)', () => {
  assert.equal(loadZone('1').name, 'The Cinder Fields'); assert.equal(loadZone('2').name, 'The Ash Reach');
  for (const id of zoneIds()) { const z = loadZone(id); assert.ok(z.name && z.world.every((w) => z.names[w]), `zone ${id}`); }
});

test('a throwaway zone99 row loads with zero edits outside it', async () => {
  const scratch = mkdtempSync(`${tmpdir()}/zones99-`);
  try {
    const two = JSON.parse(readFileSync(`${ROWS_DIR}zone2.row.json`, 'utf8'));
    writeFileSync(`${scratch}/zone99.row.json`, JSON.stringify({ name: 'Zone Ninety-Nine', names: { 'ash-reach': 'Ninety-Nine' }, world: ['ash-reach'], kit: two.kit, looks: two.looks }));
    const src = registrySource(`${scratch}/`);
    assert.match(src, /'99': zoneFromRow\(99, row99\)/);
    writeFileSync(`${scratch}/registry.ts`, src.replace("'./from-row.ts'", `'${pathToFileURL(`${ZONES_DIR}from-row.ts`).href}'`).replaceAll("'../zone-rows/", "'./"));
    const { REGISTRY } = await import(pathToFileURL(`${scratch}/registry.ts`).href) as { REGISTRY: Record<string, Zone> };
    assert.deepEqual(Object.keys(REGISTRY), ['99']);
    assert.equal(REGISTRY['99']!.name, 'Zone Ninety-Nine');
    assert.ok(!zoneProblems(REGISTRY['99']!).some((p) => /name|world zone/.test(p)), 'a row alone gives a zone with its names');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
  assert.ok(!zoneIds().includes('99'), 'the real registry never saw it');
});

test('a file in origins/zone-rows that is not a zone row name is an error, never skipped', () => {
  const scratch = mkdtempSync(`${tmpdir()}/zones-bad-`);
  try {
    writeFileSync(`${scratch}/zone07.row.json`, '{}');
    assert.throws(() => registrySource(`${scratch}/`), /zone07.row.json is not a zone row name/);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('DEFAULT_ZONE is pinned to Zone 1, not "the lowest row": live keys are bare for Zone 1 and z<N>: for every other zone', () => {
  assert.equal(DEFAULT_ZONE, '1');
  assert.ok(zoneIds().includes(DEFAULT_ZONE));
  assert.equal(zoneKeyPrefix('1'), ''); assert.equal(zoneKeyPrefix('2'), 'z2:'); assert.equal(zoneKeyPrefix('3'), 'z3:'); assert.equal(zoneKeyPrefix('10'), 'z10:');
  assert.match(readFileSync(`${ZONES_DIR}loader.ts`, 'utf8'), /export const DEFAULT_ZONE = '1';/, 'a literal, never zoneIds()[0]: the registry order must not move the keys');
});
