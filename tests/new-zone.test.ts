// scripts/new-zone.mjs makes a zone from a biome and one number: the folder it writes loads, and nothing outside that folder changes (Lead 2026-10-09, "test zone 999 loads, no edits outside the folder").
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { registrySource, ZONES_DIR } from '../scripts/gen-zones.mjs';
import { newZone } from '../scripts/new-zone.mjs';
import { zoneIds, zoneProblems, type Zone } from '../origins/zones/loader.ts';
import { BIOMES, DEFAULT_BIOME } from '../origins/zones/biomes.ts';
import { resolveSpec } from '../origins/zones/resolve.ts';
import biomesData from '../origins/zones/biomes-data.ts';

const tree = (dir: string): string[] => readdirSync(dir, { recursive: true }).map(String).sort();

test('zone 999 from a biome and a number loads, and only its own folder appears', async () => {
  const scratch = mkdtempSync(`${tmpdir()}/newzone-`);
  try {
    cpSync(`${ZONES_DIR}zone2`, `${scratch}/zone2`, { recursive: true });   // the template the kit and looks are copied from
    const before = tree(scratch);
    newZone({ n: 999, biome: 'ash-wastes', name: 'Zone Nine Nine Nine', dir: `${scratch}/` });
    const added = tree(scratch).filter((p) => !before.includes(p));
    assert.deepEqual(added, ['zone999', 'zone999/kit.ts', 'zone999/look.ts', 'zone999/spawns.ts', 'zone999/zone.ts'], 'only the new folder and its four files');
    assert.deepEqual(before, tree(scratch).filter((p) => before.includes(p)), 'nothing existing was removed');
    const src = registrySource(`${scratch}/`);
    assert.match(src, /'999': \{ \.\.\.zone999, spawns: spawns999, kit: kit999, looks: looks999 \}/);
    writeFileSync(`${scratch}/registry.ts`, src);
    const { REGISTRY } = await import(pathToFileURL(`${scratch}/registry.ts`).href) as { REGISTRY: Record<string, Zone> };
    const z = REGISTRY['999']!;
    assert.deepEqual([z.id, z.level, z.name], ['999', 999, 'Zone Nine Nine Nine']);
    assert.deepEqual(zoneProblems(z), [], 'a generated zone passes the loader\'s own checks');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
  assert.ok(!zoneIds().includes('999'), 'the real registry never saw it');
});

test('new-zone refuses a bad number, an unknown biome, an empty name and an existing zone', () => {
  const scratch = mkdtempSync(`${tmpdir()}/newzone-bad-`);
  try {
    cpSync(`${ZONES_DIR}zone2`, `${scratch}/zone2`, { recursive: true });
    const d = `${scratch}/`;
    assert.throws(() => newZone({ n: 0, dir: d }), /positive integer/);
    assert.throws(() => newZone({ n: NaN, dir: d }), /positive integer/);
    assert.throws(() => newZone({ n: 5, biome: 'moon', dir: d }), /unknown biome moon/);
    assert.throws(() => newZone({ n: 5, name: '  ', dir: d }), /name is empty/);
    assert.throws(() => newZone({ n: 2, dir: d }), /zone2 already exists/);
    assert.deepEqual(tree(scratch).filter((p) => p.startsWith('zone5')), [], 'a refused zone leaves nothing behind');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('a zone name with quotes is written as a valid string', async () => {
  const scratch = mkdtempSync(`${tmpdir()}/newzone-q-`);
  try {
    cpSync(`${ZONES_DIR}zone2`, `${scratch}/zone2`, { recursive: true });
    newZone({ n: 7, name: `The "Ash" Reach`, dir: `${scratch}/` });
    const z = (await import(pathToFileURL(`${scratch}/zone7/zone.ts`).href) as { default: { name: string } }).default;
    assert.equal(z.name, 'The "Ash" Reach');
    assert.ok(readFileSync(`${scratch}/zone7/zone.ts`, 'utf8').includes('level: 7'));
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('the copied kit and looks say whose they are (Zone N, a copy of Zone 2\'s), not "Zone 2\'s kit"', () => {
  const scratch = mkdtempSync(`${tmpdir()}/newzone-h-`);
  try {
    cpSync(`${ZONES_DIR}zone2`, `${scratch}/zone2`, { recursive: true });
    newZone({ n: 31, dir: `${scratch}/` });
    for (const f of ['kit.ts', 'look.ts']) {
      const [first, ...rest] = readFileSync(`${scratch}/zone31/${f}`, 'utf8').split('\n');
      assert.match(first!, /^\/\/ Zone 31's (kit|looks): a copy of Zone 2's/, f);
      assert.equal(rest.join('\n'), readFileSync(`${scratch}/zone2/${f}`, 'utf8').split('\n').slice(1).join('\n'), `${f}: everything after the header is the template's`);
    }
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('a copy that fails after the folder is made leaves no half-made folder behind', () => {
  const scratch = mkdtempSync(`${tmpdir()}/newzone-f-`);   // no zone2 here: reading the template throws after the folder exists
  try {
    assert.throws(() => newZone({ n: 5, dir: `${scratch}/` }), /ENOENT/);
    assert.deepEqual(readdirSync(scratch), []);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('the biome presets are the literal data file, and the default biome is one of them', () => {
  assert.equal(BIOMES, biomesData);
  assert.ok(Object.hasOwn(BIOMES, DEFAULT_BIOME));
});

test('every biome preset resolves clean (a biome no zone names is never validated by a zone, so it is checked here)', () => {
  for (const b of Object.keys(BIOMES)) assert.deepEqual(resolveSpec({ biome: b }).problems, [], b);
});
