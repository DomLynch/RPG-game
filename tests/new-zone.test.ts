// scripts/new-zone.mjs makes a zone from a biome and one number: it writes ONE row file (origins/zone-rows/zone<N>.row.json) and nothing else changes (Lead 2026-10-09, "test zone 999 loads, no edits outside"; 2026-10-11 the row IS the zone).
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { registrySource, ROWS_DIR } from '../scripts/gen-zones.mjs';
import { newZone } from '../scripts/new-zone.mjs';
import { loadZone, zoneIds, zoneProblems, type Zone } from '../origins/zones/loader.ts';
import { zoneFromRow } from '../origins/zones/from-row.ts';
import { BIOMES, DEFAULT_BIOME } from '../origins/zones/biomes.ts';
import { resolveSpec } from '../origins/zones/resolve.ts';
import biomesData from '../origins/zones/biomes.json' with { type: 'json' };

const rowOf = (id: string) => JSON.parse(readFileSync(`${ROWS_DIR}zone${id}.row.json`, 'utf8')) as Record<string, any>;
const scratchDir = (tag: string) => mkdtempSync(`${tmpdir()}/newzone-${tag}-`);

test('zone 999 from a biome and a number loads, and only its own row file appears', async () => {
  const scratch = scratchDir('a');
  try {
    newZone({ n: 999, biome: 'ash-wastes', name: 'Zone Nine Nine Nine', dir: `${scratch}/` });
    assert.deepEqual(readdirSync(scratch), ['zone999.row.json'], 'one row file, nothing else');
    const src = registrySource(`${scratch}/`);
    assert.match(src, /'999': zoneFromRow\(999, row999\)/);
    writeFileSync(`${scratch}/registry.ts`, src.replace("'./from-row.ts'", `'${pathToFileURL(`${ROWS_DIR}../zones/from-row.ts`).href}'`).replaceAll("'../zone-rows/", `'./`));
    const { REGISTRY } = await import(pathToFileURL(`${scratch}/registry.ts`).href) as { REGISTRY: Record<string, Zone> };
    const z = REGISTRY['999']!;
    assert.deepEqual([z.id, z.level, z.name], ['999', 999, 'Zone Nine Nine Nine']);
    assert.deepEqual(zoneProblems(z), [], 'a generated zone passes the loader\'s own checks');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
  assert.ok(!zoneIds().includes('999'), 'the real registry never saw it');
});

test('new-zone refuses a bad number, an unknown biome, an empty name and an existing zone', () => {
  const scratch = scratchDir('bad'), d = `${scratch}/`;
  try {
    assert.throws(() => newZone({ n: 0, dir: d }), /positive integer/);
    assert.throws(() => newZone({ n: NaN, dir: d }), /positive integer/);
    assert.throws(() => newZone({ n: 5, biome: 'moon', dir: d }), /unknown biome moon/);
    assert.throws(() => newZone({ n: 5, name: '  ', dir: d }), /name is empty/);
    newZone({ n: 6, dir: d });
    assert.throws(() => newZone({ n: 6, dir: d }), /zone6 already exists/);
    assert.deepEqual(readdirSync(scratch), ['zone6.row.json'], 'a refused zone leaves nothing behind');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('a zone name with quotes is written as a valid string', () => {
  const scratch = scratchDir('q');
  try {
    newZone({ n: 7, name: `The "Ash" Reach`, dir: `${scratch}/` });
    assert.equal(JSON.parse(readFileSync(`${scratch}/zone7.row.json`, 'utf8')).name, 'The "Ash" Reach');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('a skeleton zone copies Zone 2\'s kit and looks and says whose they are', () => {
  const scratch = scratchDir('h');
  try {
    newZone({ n: 31, dir: `${scratch}/` });
    const row = JSON.parse(readFileSync(`${scratch}/zone31.row.json`, 'utf8')), two = rowOf('2');
    assert.deepEqual(row.kit, two.kit); assert.deepEqual(row.looks, two.looks);
    assert.match(row.notes.kit, /^Zone 31's kit: a copy of Zone 2's/);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('a row whose creatures are not at the zone\'s level band is refused (the zone number is its level), so a copied row must be re-levelled', () => {
  const scratch = scratchDir('row2');
  try {
    assert.throws(() => newZone({ n: 998, row: { ...rowOf('2'), name: 'Row Zone' }, dir: `${scratch}/` }), /level 2-3 is not the zone rule 998-999/);
    assert.deepEqual(readdirSync(scratch), []);
    const bare = newZone({ n: 998, row: { name: 'Row Zone', kit: rowOf('2').kit, looks: rowOf('2').looks }, dir: `${scratch}/` });
    assert.ok(bare.endsWith('zone998.row.json'), 'a row with no creatures is valid at any level');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('a bad row is refused BEFORE anything is written: a level key, unknown key, id mismatch, missing name, unknown biome', () => {
  const scratch = scratchDir('rowbad'), d = `${scratch}/`;
  try {
    const ok = rowOf('2');
    assert.throws(() => newZone({ n: 2, row: { ...ok, level: 5 }, dir: d }), /unknown key "level"/, 'the zone number IS its level: a row cannot set another');
    assert.throws(() => newZone({ n: 2, row: { ...ok, hp: 9 }, dir: d }), /unknown key "hp"/);
    assert.throws(() => newZone({ n: 2, row: { ...ok, id: '3' }, dir: d }), /id 3 is not zone 2/);
    assert.throws(() => newZone({ n: 2, row: { ...ok, name: '' }, dir: d }), /name is empty/);
    assert.throws(() => newZone({ n: 2, row: { ...ok, biome: 'moon' }, dir: d }), /unknown biome moon/);
    const { kit, ...noKit } = ok, { looks, ...noLooks } = ok; void kit; void looks;
    assert.throws(() => newZone({ n: 2, row: noKit, dir: d }), /"kit" is required/);
    assert.throws(() => newZone({ n: 2, row: noLooks, dir: d }), /"looks" is required/);
    assert.deepEqual(readdirSync(scratch), [], 'nothing was written by any refused row');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('zoneFromRow builds exactly what the registry holds, and a row is the zone: id and level are its number', () => {
  const z = zoneFromRow(2, rowOf('2')), { resolved: _r, fields: _f, set: _s, ...loaded } = loadZone('2');
  assert.deepEqual(z, loaded);
  assert.deepEqual([z.id, z.level, z.name], ['2', 2, 'The Ash Reach']);
});

test('the biome presets are the data file, and the default biome is one of them', () => {
  assert.equal(BIOMES, biomesData.biomes);
  assert.ok(Object.hasOwn(BIOMES, DEFAULT_BIOME));
});

test('every biome preset resolves clean (a biome no zone names is never validated by a zone, so it is checked here)', () => {
  for (const b of Object.keys(BIOMES)) assert.deepEqual(resolveSpec({ biome: b }).problems, [], b);
});
