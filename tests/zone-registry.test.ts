// Plug and play (Dom 2026-10-09): a zone is a folder, nothing else. The registry is generated from origins/zones/zone<N>/; a fixture zone 99 in a scratch folder loads with ZERO edits to any file outside its folder.
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { registrySource, ZONES_DIR, zoneFolders } from '../scripts/gen-zones.mjs';
import { loadZone, zoneIds, zoneProblems, type Zone } from '../origins/zones/loader.ts';

test('the committed registry is what the zone folders generate (npm run zones writes it)', () => {
  assert.equal(readFileSync(`${ZONES_DIR}registry.ts`, 'utf8'), registrySource(), 'stale registry: run `npm run zones`');
  assert.deepEqual(zoneIds(), (zoneFolders() as { id: string }[]).map((z) => z.id));
});

test('every zone names itself and its world zones (the tab title and the HUD read them)', () => {
  assert.equal(loadZone('1').name, 'The Cinder Fields'); assert.equal(loadZone('2').name, 'The Ash Reach');
  for (const id of zoneIds()) { const z = loadZone(id); assert.ok(z.name && z.world.every((w) => z.names[w]), `zone ${id}`); }
});

test('a throwaway zone99 folder loads with zero edits outside it', async () => {
  const scratch = mkdtempSync(`${tmpdir()}/zones99-`);
  try {
    cpSync(`${ZONES_DIR}zone2`, `${scratch}/zone99`, { recursive: true });
    writeFileSync(`${scratch}/zone99/zone.ts`, readFileSync(`${scratch}/zone99/zone.ts`, 'utf8').replace("id: '2', level: 2, name: 'The Ash Reach', names: { 'ash-reach': 'The Ash Reach' }", "id: '99', level: 99, name: 'Zone Ninety-Nine', names: { 'ash-reach': 'Ninety-Nine' }"));
    const src = registrySource(`${scratch}/`);
    assert.match(src, /'99': \{ \.\.\.zone99, spawns: spawns99, kit: kit99, looks: looks99, mobLooks: mobLooks99 \}/);
    writeFileSync(`${scratch}/registry.ts`, src);
    const { REGISTRY } = await import(pathToFileURL(`${scratch}/registry.ts`).href) as { REGISTRY: Record<string, Zone> };
    assert.deepEqual(Object.keys(REGISTRY), ['99']);
    assert.equal(REGISTRY['99']!.name, 'Zone Ninety-Nine');
    assert.ok(!zoneProblems(REGISTRY['99']!).some((p) => /name|world zone/.test(p)), 'a folder alone gives a zone with its names');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
  assert.ok(!zoneIds().includes('99'), 'the real registry never saw it');
});

test('a zone folder missing a required file is an error, never skipped', () => {
  const scratch = mkdtempSync(`${tmpdir()}/zones-bad-`);
  try { mkdirSync(`${scratch}/zone7`); writeFileSync(`${scratch}/zone7/zone.ts`, 'export default {};'); assert.throws(() => registrySource(`${scratch}/`), /zone7 is missing spawns.ts, kit.ts, look.ts/); } finally { rmSync(scratch, { recursive: true, force: true }); }
});
