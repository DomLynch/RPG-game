// scripts/new-zone.mjs makes a zone from a biome and one number: the folder it writes loads, and nothing outside that folder changes (Lead 2026-10-09, "test zone 999 loads, no edits outside the folder").
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { registrySource, ZONES_DIR } from '../scripts/gen-zones.mjs';
import { newZone } from '../scripts/new-zone.mjs';
import { loadZone, zoneIds, zoneProblems, type Zone } from '../origins/zones/loader.ts';

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

// --- one data row writes the whole folder (track B, Lead 2026-10-10): the row of today's Zone 2 regenerates Zone 2 ---
const rowOf = (id: string) => { const z = loadZone(id); return { name: z.name, names: z.names, world: z.world, level: z.level, spawns: z.spawns, kit: z.kit, looks: z.looks, ...(z.mobLooks ? { mobLooks: z.mobLooks } : {}), ...(z.place ? { place: z.place } : {}) }; };
const modules = ['zone', 'spawns', 'kit', 'look', 'mob-looks', 'place'];

test('the data row of Zone 2 regenerates a folder that loads to exactly Zone 2 (values, not bytes: JSON has no 0x hex and no comments)', async () => {
  const scratch = mkdtempSync(`${tmpdir()}/newzone-row-`);
  try {
    newZone({ n: 2, row: rowOf('2'), dir: `${scratch}/` });
    assert.deepEqual(readdirSync(`${scratch}/zone2`).sort(), modules.map((m) => `${m}.ts`).sort(), 'the same six files, no more');
    for (const m of modules) {
      const made = (await import(pathToFileURL(`${scratch}/zone2/${m}.ts`).href) as { default: unknown }).default;
      const real = (await import(pathToFileURL(`${ZONES_DIR}zone2/${m}.ts`).href) as { default: unknown }).default;
      assert.deepEqual(made, real, `${m}.ts`);
    }
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('a row whose creatures are not at the zone\'s level band is refused (the zone number is its level), so a copied row must be re-levelled', () => {
  const scratch = mkdtempSync(`${tmpdir()}/newzone-row2-`);
  try {
    assert.throws(() => newZone({ n: 998, row: { ...rowOf('2'), name: 'Row Zone' }, dir: `${scratch}/` }), /level 2-3 is not the zone rule 998-999/);
    assert.deepEqual(readdirSync(scratch), []);
    const bare = newZone({ n: 998, row: { name: 'Row Zone', kit: rowOf('2').kit, looks: rowOf('2').looks }, dir: `${scratch}/` });
    assert.ok(bare.endsWith('zone998/'), 'a row with no creatures is valid at any level');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('a bad row is refused BEFORE anything is written: wrong creature level, unknown key, id mismatch, missing name, unknown biome', () => {
  const scratch = mkdtempSync(`${tmpdir()}/newzone-rowbad-`);
  try {
    const d = `${scratch}/`, ok = rowOf('2');
    assert.throws(() => newZone({ n: 2, row: { ...ok, level: 5 }, dir: d }), /invalid/, 'zone level 5 but its creatures are level 2-3');
    assert.throws(() => newZone({ n: 2, row: { ...ok, hp: 9 }, dir: d }), /unknown key "hp"/);
    assert.throws(() => newZone({ n: 2, row: { ...ok, id: '3' }, dir: d }), /id 3 is not zone 2/);
    assert.throws(() => newZone({ n: 2, row: { ...ok, name: '' }, dir: d }), /name is empty/);
    assert.throws(() => newZone({ n: 2, row: { ...ok, biome: 'moon' }, dir: d }), /unknown biome moon/);
    assert.deepEqual(readdirSync(scratch), [], 'nothing was written by any refused row');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});
