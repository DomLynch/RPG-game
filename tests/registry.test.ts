// The shared registry loader: every rejection has a fixture, the gate reports file:row:id + the rule, and the towns run on it.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { RegistryError, buildTables, checkTables, keyedRows, loadRegistry, type Manifest, type TableData } from '../src/core/server.ts';

const creature: Manifest = { table: 'creature', file: 'c.json', key: 'id', required: { name: 'string' } };
const loot: Manifest = { table: 'loot', file: 'l.json', key: 'id', required: { rolls: 'array', 'rolls[].chance': 'integer' }, refs: { 'rolledBy[]': 'creature', biome: 'biome' } };
const tables = (c: Record<string, unknown>[], l: Record<string, unknown>[], extra: TableData[] = []): TableData[] => [{ manifest: creature, rows: c }, { manifest: loot, rows: l }, ...extra];
const biome: TableData = { manifest: { table: 'biome', file: 'b.json', key: 'id', required: {} }, rows: [{ id: 'ash' }] };
const goodLoot = { id: 'l1', rolls: [{ chance: 5 }], rolledBy: ['wolf'], biome: 'ash' };
const rules = (t: TableData[]) => checkTables(t).problems.map((p) => `${p.file}:${p.row}:${p.id} ${p.rule}`);

test('a clean set of tables loads, ids index by table, and cross-table refs resolve', () => {
  const r = loadRegistry(tables([{ id: 'wolf', name: 'Wolf' }], [goodLoot], [biome]));
  assert.deepEqual([...r.ids.get('creature')!], ['wolf']);
  assert.equal(r.rows.get('loot')!.get('l1')!.biome, 'ash');
});

test('duplicate id rejects (never last-wins)', () => {
  assert.deepEqual(rules(tables([{ id: 'wolf', name: 'a' }, { id: 'wolf', name: 'b' }], [], [biome])), ['c.json:1:wolf duplicate-id']);
});

test('unknown ref rejects, including inside an array and across tables', () => {
  assert.deepEqual(rules(tables([{ id: 'wolf', name: 'W' }], [{ ...goodLoot, rolledBy: ['wolf', 'ghost'] }], [biome])), ['l.json:0:l1 unknown-ref']);
  assert.deepEqual(rules(tables([{ id: 'wolf', name: 'W' }], [{ ...goodLoot, biome: 'moon' }], [biome])), ['l.json:0:l1 unknown-ref']);
});

test('missing required field and wrong type reject (nested and per array element)', () => {
  assert.deepEqual(rules(tables([{ id: 'wolf' }], [], [biome])), ['c.json:0:wolf missing-field']);
  assert.deepEqual(rules(tables([{ id: 'wolf', name: 7 }], [], [biome])), ['c.json:0:wolf wrong-type']);
  assert.deepEqual(rules(tables([{ id: 'wolf', name: 'W' }], [{ ...goodLoot, rolls: [{ chance: 5 }, { chance: 1.5 }, {}] }], [biome])), ['l.json:0:l1 wrong-type', 'l.json:0:l1 missing-field']);
});

test('a bad key and a manifest that points at an unregistered table reject', () => {
  assert.deepEqual(rules(tables([{ name: 'W' }], [], [biome])), ['c.json:0:undefined bad-key']);
  assert.deepEqual(rules([{ manifest: loot, rows: [] }]).sort(), ['l.json:-1:loot bad-manifest', 'l.json:-1:loot bad-manifest']);
});

test('loadRegistry throws a RegistryError that names file:row:id and the rule', () => {
  assert.throws(() => loadRegistry(tables([{ id: 'a', name: 'x' }, { id: 'a', name: 'y' }], [], [biome])), (e: unknown) => e instanceof RegistryError && /c\.json:1:a duplicate-id/.test(e.message));
});

test('external id sets satisfy refs, and keyed tables become rows', () => {
  const t = tables([{ id: 'wolf', name: 'W' }], [goodLoot]);
  assert.deepEqual(checkTables(t, { biome: ['ash'] }).problems, []);
  assert.deepEqual(keyedRows({ smith: { x: 1 }, healer: {} }), [{ id: 'smith', x: 1 }, { id: 'healer' }]);
});

const treeWith = (edit: (towns: any) => void): { dir: string; run: () => { status: number | null; err: string; out: string } } => {
  const dir = mkdtempSync(join(tmpdir(), 'registry-'));
  cpSync('origins', join(dir, 'origins'), { recursive: true });
  cpSync('scripts', join(dir, 'scripts'), { recursive: true });
  for (const link of ['src', 'package.json', 'node_modules']) symlinkSync(resolve(link), join(dir, link));
  const file = join(dir, 'origins/region1/towns.json'), towns = JSON.parse(readFileSync(file, 'utf8'));
  edit(towns);
  writeFileSync(file, JSON.stringify(towns));
  return { dir, run: () => { const r = spawnSync(process.execPath, ['scripts/registry-check.mjs', 'origins'], { cwd: dir, encoding: 'utf8' }); return { status: r.status, err: r.stderr, out: r.stdout }; } };
};

test('the gate passes on the real tree and fails with file:row:id + rule on a broken towns row (a new trade is one row)', () => {
  const real = spawnSync(process.execPath, ['scripts/registry-check.mjs'], { encoding: 'utf8' });
  assert.equal(real.status, 0, real.stderr);
  let t = treeWith((d) => { d.towns[1].ruler.temperament = 'brooding'; });
  try { const r = t.run(); assert.equal(r.status, 1); assert.match(r.err, /origins\/region1\/towns\.json:1:town:cinder-hold unknown-ref/); } finally { rmSync(t.dir, { recursive: true, force: true }); }
  t = treeWith((d) => { d.definitions.temperaments.brooding = {}; d.towns[1].ruler.temperament = 'brooding'; });
  try { assert.equal(t.run().status, 0); } finally { rmSync(t.dir, { recursive: true, force: true }); }
  t = treeWith((d) => { d.towns.push({ ...d.towns[0] }); });
  try { assert.match(t.run().err, /towns\.json:3:town:exchange-quarter duplicate-id/); } finally { rmSync(t.dir, { recursive: true, force: true }); }
});

test('the runtime load throws on the same break (content.ts loads the towns through the registry)', () => {
  const t = treeWith((d) => { d.towns[2].services[0].trade = 'wizard'; });
  try {
    writeFileSync(join(t.dir, 'probe.ts'), "import './origins/region1/content.ts';");
    const r = spawnSync(process.execPath, ['probe.ts'], { cwd: t.dir, encoding: 'utf8' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /town:mere-end unknown-ref/);
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});

test('a derived table makes a link carried on a row checkable: one creature in two rows is a duplicate-id, each end is a ref', () => {
  const lootT: Manifest = { table: 'loottable', file: 'l.json', key: 'id', required: {} };
  const link: Manifest = { table: 'creatureLoot', from: 'loottable', fan: 'rolledBy[]', key: 'id', required: {}, refs: { id: 'creature' } };
  const mk = (rows: object[]) => buildTables([{ manifest: creature, parsed: [{ id: 'wolf', name: 'W' }, { id: 'bear', name: 'B' }] }, { manifest: lootT, parsed: rows }, { manifest: link }]);
  assert.deepEqual(checkTables(mk([{ id: 't1', rolledBy: ['wolf'] }, { id: 't2', rolledBy: ['bear'] }])).problems, []);
  assert.deepEqual(rules(mk([{ id: 't1', rolledBy: ['wolf'] }, { id: 't2', rolledBy: ['wolf'] }])), ['l.json:1:wolf duplicate-id']);
  assert.deepEqual(rules(mk([{ id: 't1', rolledBy: ['ghost'] }])), ['l.json:0:ghost unknown-ref']);
});

test('a duplicate key inside one JSON object (which JSON.parse would silently resolve to the last) fails the gate on the raw text', () => {
  const t = treeWith(() => {});
  try {
    const file = join(t.dir, 'origins/region1/towns.json'), text = readFileSync(file, 'utf8');
    writeFileSync(file, text.replace(/"smith":\s*\{/, "\"smith\":{\"x\":1},\"smith\":{"));
    const r = t.run();
    assert.equal(r.status, 1);
    assert.match(r.err, /towns\.json:\d+: duplicate key "smith"/);
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});

test('optional fields: absent is fine, present and the wrong type is wrong-type', () => {
  const m: Manifest = { table: 'trade', file: 't.json', key: 'id', required: {}, optional: { shop: 'boolean', order: 'integer', 'kit.walls': 'number' } };
  const t = (rows: Record<string, unknown>[]) => [{ manifest: m, rows }];
  assert.deepEqual(rules(t([{ id: 'smith' }, { id: 'baker', shop: true, order: 1, kit: { walls: 2 } }])), []);
  assert.deepEqual(rules(t([{ id: 'smith', shop: 'yes' }, { id: 'baker', order: 1.5 }, { id: 'x', kit: { walls: 'tall' } }])), ['t.json:0:smith wrong-type', 't.json:1:baker wrong-type', 't.json:2:x wrong-type']);
});

test('a field with min/max: the string form still works, an in-range row loads, an out-of-range row is out-of-range naming file:row:id and the bound', () => {
  const m: Manifest = { table: 'flee', file: 'f.json', key: 'id', required: { percent: { type: 'integer', min: 1, max: 99 }, plain: 'integer', 'catch[]': { type: 'number', min: 0.5 } }, optional: { still: { type: 'integer', max: 30 } } };
  const run = (rows: Record<string, unknown>[]) => checkTables([{ manifest: m, rows }]).problems.map((p) => `${p.file}:${p.row}:${p.id} ${p.rule}${p.rule === 'out-of-range' ? ` ${p.message}` : ''}`);
  const ok = { id: 'a', percent: 50, plain: 7_000_000, catch: [0.5, 2] };
  assert.deepEqual(run([ok, { ...ok, id: 'b', percent: 1, still: 30 }, { ...ok, id: 'c', percent: 99 }]), []);   // both bounds inclusive; plain has no range; an optional bound holds when present
  assert.deepEqual(run([{ ...ok, percent: 0 }]), ['f.json:0:a out-of-range percent = 0 is outside 1..99']);
  assert.deepEqual(run([{ ...ok, percent: 100 }]), ['f.json:0:a out-of-range percent = 100 is outside 1..99']);
  assert.deepEqual(run([{ ...ok, still: 31 }]), ['f.json:0:a out-of-range still = 31 is outside -inf..30']);
  assert.deepEqual(run([{ ...ok, catch: [1, 0.4] }]), ['f.json:0:a out-of-range catch[] = 0.4 is outside 0.5..inf']);   // every element of an array field
  assert.deepEqual(run([{ ...ok, percent: 'x' }]), ['f.json:0:a wrong-type']);                                          // a wrong type is never also out of range
  assert.deepEqual(run([{ ...ok, still: undefined }]), []);                                                               // optional + absent is fine
});

test('a manifest with a range on a non-number field, or min above max, is bad-manifest', () => {
  const bad = (spec: unknown) => checkTables([{ manifest: { table: 't', file: 't.json', key: 'id', required: { x: spec as never } }, rows: [] }]).problems.map((p) => `${p.rule}: ${p.message}`);
  assert.deepEqual(bad({ type: 'string', max: 4 }), ['bad-manifest: x: min/max need a number or integer field, not string']);
  assert.deepEqual(bad({ type: 'integer', min: 5, max: 1 }), ['bad-manifest: x: min 5 is above max 1']);
  assert.deepEqual(bad({ type: 'integer', min: 1, max: 5 }), []);
});

test('a manifest spec is checked as strictly as a row: an unknown key, a non-numeric or non-finite bound, an unknown type and a non-spec value are bad-manifest (never silently unbounded)', () => {
  const bad = (spec: unknown) => checkTables([{ manifest: { table: 't', file: 't.json', key: 'id', required: { x: spec as never } }, rows: [] }]).problems.map((p) => `${p.rule}: ${p.message}`);
  assert.deepEqual(bad({ type: 'integer', mx: 3 }), ['bad-manifest: x: unknown spec key "mx" (a spec has type, min and max)']);       // the misspelled max the Auditor named
  assert.deepEqual(bad({ type: 'integer', minimum: 1, max: 3 }), ['bad-manifest: x: unknown spec key "minimum" (a spec has type, min and max)']);
  assert.deepEqual(bad({ type: 'integer', min: '1' }), ['bad-manifest: x: min must be a finite number']);
  assert.deepEqual(bad({ type: 'integer', max: null }), ['bad-manifest: x: max must be a finite number']);
  assert.deepEqual(bad({ type: 'number', max: Number.NaN }), ['bad-manifest: x: max must be a finite number']);
  assert.deepEqual(bad({ type: 'number', min: Number.NEGATIVE_INFINITY }), ['bad-manifest: x: min must be a finite number']);
  assert.deepEqual(bad({ type: 'int', min: 1 }), ['bad-manifest: x: type must be one of string, number, integer, boolean, array, object, any', 'bad-manifest: x: min/max need a number or integer field, not int']);
  assert.deepEqual(bad({ min: 1 }), ['bad-manifest: x: type must be one of string, number, integer, boolean, array, object, any', 'bad-manifest: x: min/max need a number or integer field, not undefined']);
  assert.deepEqual(bad(7), ['bad-manifest: x: a field spec is a type string or { type, min?, max? }']);
  assert.deepEqual(bad(null), ['bad-manifest: x: a field spec is a type string or { type, min?, max? }']);
  assert.deepEqual(bad({ type: 'integer' }), []);                  // an object spec with no range is fine
  assert.deepEqual(bad({ type: 'number', min: -2.5, max: 2.5 }), []);   // negative and fractional bounds are fine
  assert.deepEqual(bad('integer'), []);                            // the string form is as it always was
});

test('unique fields: a second row claiming the same value is duplicate-value naming the first owner', () => {
  const m: Manifest = { table: 'trade', file: 't.json', key: 'id', required: {}, unique: ['order'] };
  const r = checkTables([{ manifest: m, rows: [{ id: 'smith', order: 0 }, { id: 'baker', order: 1 }, { id: 'tanner', order: 0 }, { id: 'none' }, { id: 'none2' }] }]);
  assert.deepEqual(r.problems.map((p) => `${p.row}:${p.id} ${p.rule}: ${p.message}`), ['2:tanner duplicate-value: order 0 is already on smith']);
});
