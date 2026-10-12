// Towns are rows (origins/region1/towns.json): the rows are byte-identical to the old code, and a new trade, temperament or town is one row.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { BUNDLE, LOCAL } from '../origins/region1/content.ts';
import { loadRegion1, type Local } from '../origins/region1/load.ts';
import { REGION1_WORLD } from '../origins/region1/world.ts';

const TOWNS_SHA = 'edfe8162dc5b9092bb61570ff8cd1f4591000eb460f4995695bf39a09bbe47b1';
const load = (edit: (l: Local) => void) => { const l = structuredClone(LOCAL) as Local; edit(l); return loadRegion1(REGION1_WORLD, BUNDLE, l); };
const codes = (r: ReturnType<typeof loadRegion1>) => (r.ok ? [] : r.issues.map((i) => `${i.code} ${i.path}`));

test('the town rows equal the pre-rows code byte for byte', () => {
  assert.equal(createHash('sha256').update(JSON.stringify(LOCAL.towns)).digest('hex'), TOWNS_SHA);
});

test('a new trade and temperament are real rows: edit only towns.json in a copy of the tree, a fresh process loads them', () => {
  const dir = mkdtempSync(join(tmpdir(), 'town-rows-'));
  try {
    cpSync('origins', join(dir, 'origins'), { recursive: true });
    for (const link of ['src', 'scripts', 'package.json', 'node_modules']) symlinkSync(resolve(link), join(dir, link));
    const file = join(dir, 'origins/region1/towns.json'), rows = JSON.parse(readFileSync(file, 'utf8'));
    rows.definitions.trades.armourer = {};
    rows.definitions.temperaments.brooding = {};
    rows.towns[1].ruler.temperament = 'brooding';
    rows.towns[1].services[1].trade = 'armourer';
    writeFileSync(file, JSON.stringify(rows));
    writeFileSync(join(dir, 'probe.ts'), `import { loadRegion1 } from './origins/region1/load.ts';
const r = loadRegion1();
console.log(JSON.stringify({ ok: r.ok, issues: r.ok ? [] : r.issues, trade: r.ok && r.value.towns[1].services[1].trade, temper: r.ok && r.value.towns[1].ruler.temperament }));`);
    const out = spawnSync(process.execPath, ['probe.ts'], { cwd: dir, encoding: 'utf8' });
    assert.equal(out.status, 0, out.stderr);
    assert.deepEqual(JSON.parse(out.stdout.trim().split('\n').pop()!), { ok: true, issues: [], trade: 'armourer', temper: 'brooding' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an unknown trade, temperament or title is a data error', () => {
  assert.ok(codes(load((l) => { l.towns[1]!.services[0]!.trade = 'armourer'; })).some((c) => c.startsWith('unknown-id') && c.includes('trade')));
  assert.ok(codes(load((l) => { l.towns[0]!.ruler.temperament = 'brooding'; })).some((c) => c.startsWith('unknown-id') && c.includes('temperament')));
  assert.ok(codes(load((l) => { l.towns[0]!.ruler.title = 'doge'; })).some((c) => c.startsWith('unknown-id') && c.includes('title')));
});

test('an unknown town field passes through in ext instead of being refused', () => {
  const r = load((l) => { (l.towns[2] as Record<string, unknown>)['mod:market'] = { day: 'friday' }; });
  assert.ok(r.ok, JSON.stringify(codes(r)));
  assert.deepEqual(r.value.towns[2]!.ext, { 'mod:market': { day: 'friday' } });
  assert.deepEqual(r.value.towns[0]!.ext, {});
});
