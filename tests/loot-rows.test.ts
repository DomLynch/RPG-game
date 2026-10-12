// Loot tables are ROWS (origins/region1/loot-tables.json): same bytes as the old code, every row is contract-checked, and a new table is one row, no code.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { BUNDLE, LOCAL, LOOT_TABLES } from '../origins/region1/content.ts';
import { loadRegion1 } from '../origins/region1/load.ts';
import { REGION1_WORLD } from '../origins/region1/world.ts';
import { onDataPath } from '../scripts/lib/data-only.mjs';

const ROWS_FILE = 'origins/region1/loot-tables.json';
const rows = (): Record<string, any>[] => JSON.parse(readFileSync(ROWS_FILE, 'utf8'));

test('the rows file is on the data path, and BUNDLE is byte-identical to what the code built (key order included)', () => {
  assert.ok(onDataPath(ROWS_FILE));
  assert.equal(createHash('sha256').update(JSON.stringify(BUNDLE)).digest('hex'), '37812f688d80fc18b2947082f7ff9783825adff08d8a868637126d14f8efe207');
  assert.equal(LOOT_TABLES.length, 12);
});

test('a new loot table is one real row: edit only loot-tables.json in a copy of the tree, and a fresh process loads it and the creature rolls it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loot-rows-'));
  try {
    cpSync('origins', join(dir, 'origins'), { recursive: true });
    for (const link of ['src', 'scripts', 'package.json', 'node_modules']) symlinkSync(resolve(link), join(dir, link));
    const file = join(dir, ROWS_FILE), all = JSON.parse(readFileSync(file, 'utf8')) as Record<string, any>[];
    const row = structuredClone(all.find((t) => t.id === 'loottable:ember-wolf')!);
    row.id = 'loottable:zone-test-new';
    writeFileSync(file, JSON.stringify([...all.filter((t) => t.id !== 'loottable:ember-wolf'), row]));   // the Ember Wolf now rolls the new row
    writeFileSync(join(dir, 'probe.ts'), `import { LOCAL } from './origins/region1/content.ts';
import { loadRegion1 } from './origins/region1/load.ts';
const r = loadRegion1();
console.log(JSON.stringify({ ok: r.ok, issues: r.ok ? [] : r.issues, rolls: LOCAL.creatureLoot['character:ember-wolf'] }));`);
    const out = spawnSync(process.execPath, ['probe.ts'], { cwd: dir, encoding: 'utf8' });
    assert.equal(out.status, 0, out.stderr);
    const got = JSON.parse(out.stdout.trim().split('\n').pop()!);
    assert.deepEqual(got, { ok: true, issues: [], rolls: 'loottable:zone-test-new' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a row that breaks the contract is refused, and a row nothing rolls is refused (no dead tables)', () => {
  const bad = structuredClone(rows().find((t) => t.id === 'loottable:ember-wolf')!);
  delete bad.rolledBy;
  bad.id = 'loottable:zone-test-bad';
  bad.presentation = 'nonsense';
  assert.ok(!loadRegion1(REGION1_WORLD, [...structuredClone(BUNDLE), bad], LOCAL).ok);
  const dead = structuredClone(rows().find((t) => t.id === 'loottable:ember-wolf')!);
  delete dead.rolledBy;
  dead.id = 'loottable:zone-test-dead';
  const r = loadRegion1(REGION1_WORLD, [...structuredClone(BUNDLE), dead], LOCAL);
  assert.ok(!r.ok && r.issues.some((i) => i.code === 'rule-violation'));
});
