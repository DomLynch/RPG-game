// scripts/new-zone.mjs makes a zone from a biome and one number: it writes ONE row file (origins/zone-rows/zone<N>.row.json) and nothing else changes (Lead 2026-10-09, "test zone 999 loads, no edits outside"; 2026-10-11 the row IS the zone).
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { registrySource, ROWS_DIR } from '../scripts/gen-zones.mjs';
import { newZone, register, rowIds } from '../scripts/new-zone.mjs';
import { loadZone, zoneIds, zoneProblems, type Zone } from '../origins/zones/loader.ts';
import { zoneFromRow } from '../origins/zones/from-row.ts';
import { BIOMES, DEFAULT_BIOME } from '../origins/zones/biomes.ts';
import { resolveSpec } from '../origins/zones/resolve.ts';
import biomesData from '../origins/zones/biomes-data.ts';

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

test('the biome presets are the literal data file, and the default biome is one of them', () => {
  assert.equal(BIOMES, biomesData);
  assert.ok(Object.hasOwn(BIOMES, DEFAULT_BIOME));
});

test('every biome preset resolves clean (a biome no zone names is never validated by a zone, so it is checked here)', () => {
  for (const b of Object.keys(BIOMES)) assert.deepEqual(resolveSpec({ biome: b }).problems, [], b);
});

// --- `--like <M>`: a new zone from a copy of zone M (zone 91 by hand took 3 min 55 s: it repeated the place ids and named the wrong camp) ---
const withNinety = (tag: string) => { const dir = scratchDir(tag); writeFileSync(`${dir}/zone90.row.json`, readFileSync(`${ROWS_DIR}zone90.row.json`, 'utf8')); return dir; };

test('--like 90 makes the next free zone: every own place id renamed to the new stem, the camp in its own world zone, the shared road end untouched, and it passes the loader\'s checks', () => {
  const dir = withNinety('like');
  try {
    const file = newZone({ like: 90, name: 'Marsh Reach', dir: `${dir}/` });
    assert.equal(file, `${dir}/zone91.row.json`, 'the next free number above 90');
    const row = JSON.parse(readFileSync(file, 'utf8')), src = rowOf('90');
    assert.equal(row.name, 'Marsh Reach'); assert.deepEqual(row.world, ['marsh-reach-field']); assert.deepEqual(row.names, { 'marsh-reach-field': 'Marsh Reach' });
    assert.equal(row.look.props.camp, 'marsh-reach-field', 'the camp names its own world zone');
    assert.deepEqual(Object.keys(row.place.zones), ['marsh-reach-field']);
    assert.deepEqual(Object.keys(row.place.zones['marsh-reach-field'].layout), ['marsh-reach-gate', 'marsh-reach-camp']);
    const j = row.place.joins[0]; assert.deepEqual([j.link, j.to, j.here, j.there, j.landmark, j.zone], ['marsh-reach', 'marsh-reach-field', 'marsh-marsh-reach', 'marsh-reach-gate', 'marsh-marsh-reach', 'drowned-marsh']);
    assert.deepEqual(row.place.waypoints, ['marsh-marsh-reach', 'marsh-reach-gate', 'marsh-reach-camp']);
    assert.equal(row.place.zones['marsh-reach-field'].connections.road.to, 'drowned-marsh', 'the real place on the other side is not renamed');
    assert.equal(row.unlisted, true, 'a sandbox copy stays unlisted');
    const mine = rowIds(row), theirs = rowIds(src);
    assert.deepEqual([...mine].filter((id) => theirs.has(id)), ['drowned-marsh'], 'the only id the two zones share is the real place the road leads to');
    assert.deepEqual(zoneProblems(zoneFromRow(91, row)), []);
    assert.deepEqual(readdirSync(dir).sort(), ['zone90.row.json', 'zone91.row.json'], 'one new row file');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('--like refuses ids another zone already uses, a stem equal to the source\'s, a missing source and a bad --set, and leaves nothing behind', () => {
  const dir = withNinety('likebad'), d = `${dir}/`;
  try {
    newZone({ like: 90, name: 'Marsh Reach', dir: d });
    assert.throws(() => newZone({ like: 90, name: 'Marsh Reach', dir: d }), /ids already used by another zone: .*marsh-reach-field \(zone 91\)/);
    assert.throws(() => newZone({ like: 90, name: 'Marsh Test', dir: d }), /ids already used by another zone: marsh-test \(zone 90\)/, 'a stem that makes an id the source already has (its road landmark marsh-test) is refused');
    assert.throws(() => newZone({ like: 90, name: 'Other', stem: 'test', dir: d }), /source zone's own stem/);
    assert.throws(() => newZone({ like: 77, dir: d }), /no .*zone77\.row\.json/);
    assert.throws(() => newZone({ like: 90, name: 'Dusk Two', set: ['look.nope.x=1'], dir: d }), /--set look\.nope\.x: nope is not an object/);
    assert.throws(() => newZone({ like: 90, name: 'Dusk Two', set: ['novalue'], dir: d }), /expected path=value/);
    assert.throws(() => newZone({ like: 90, name: 'Bad Stem', stem: 'Bad Stem', dir: d }), /lower-case hyphen token/);
    assert.deepEqual(readdirSync(dir).sort(), ['zone90.row.json', 'zone91.row.json'], 'refused zones wrote nothing');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('--like takes --set overrides (a JSON value, or a bare word as a string) and an explicit number', () => {
  const dir = withNinety('likeset');
  try {
    const file = newZone({ n: 95, like: 90, name: 'Dusk Two', set: ['look.sky=marsh', 'look.props.density=1.5', 'look.fog.density=0.03'], dir: `${dir}/` });
    assert.equal(file, `${dir}/zone95.row.json`);
    const row = JSON.parse(readFileSync(file, 'utf8'));
    assert.deepEqual([row.look.sky, row.look.props.density, row.look.fog.density], ['marsh', 1.5, 0.03]);
    assert.equal(row.look.props.camp, 'dusk-two-field');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('register() regenerates the registry from the rows, so a new zone needs no manual gen-zones step', () => {
  const dir = withNinety('reg');
  const realBefore = readFileSync(`${ROWS_DIR}../zones/registry.ts`, 'utf8');
  try {
    newZone({ like: 90, name: 'Marsh Reach', dir: `${dir}/` });
    const file = register({ dir: `${dir}/`, file: `${dir}/registry.ts` });
    const text = readFileSync(file, 'utf8');
    assert.match(text, /'90': zoneFromRow\(90, row90\)/); assert.match(text, /'91': zoneFromRow\(91, row91\)/);
    assert.equal(text, registrySource(`${dir}/`), 'byte-identical to what gen-zones.mjs writes');
  } finally { rmSync(dir, { recursive: true, force: true }); }
  assert.equal(readFileSync(`${ROWS_DIR}../zones/registry.ts`, 'utf8'), realBefore, 'the real registry was not touched');
});
