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
  assert.equal(createHash('sha256').update(JSON.stringify(BUNDLE)).digest('hex'), '7db299d53556b7f9a2f9aa861c05e4454658c93ffff383c9790e9abf140e14e0');   // re-pinned 2026-10-17 (fix-forward, lootStarter): +item:loot.starter.Longsword in the catalogue slice of BUNDLE, was 7715bd7b…; nothing else moved   // re-pinned 2026-10-16 again (fix-forward, #2878 on top of the troll camp move #2877: +loottable:giant-salamander and the troll-cave waypoint; alone 6234f66f... and cb29b740...; the sha before it a5d22a9629fed8b943e855ed6f92382b7a779b616dc7f83962cd136895ca5874); re-pinned 2026-10-16 (fix-forward, the Cave Troll placement #2877: +loottable:cave-troll in the rows; the sha before it dca296315736308700aa4f32bbf611ada78c281115a1e9615a38c552df4dd2d0); re-pinned 2026-10-15 (three times; the third gain is the goblin scrap cap and shin plates, the sha before it ff73583edfed91007d8a5e8d9955449ef3f196885a2a0e1c03023a27c69bb73a; earlier: the second gain is the knife, cleaver, gladius and estoc starter items, the sha before it 085baf4d40d4db76ad0eddbf95180a7df1d36af45529d58193da9e30332ecda7): BUNDLE gained exactly one item, item:starter.rusty-sword (ground loot slice 1). The old pin 37812f68... is what the bundle hashes to WITHOUT that item (checked on the VPS).
  assert.equal(LOOT_TABLES.length, 14);   // + loottable:cave-troll and loottable:giant-salamander (2026-10-16, the Cave Troll and Giant Salamander placements)
});

test('a new loot table is one real row: edit only loot-tables.json in a copy of the tree, and a fresh process loads it and the creature rolls it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loot-rows-'));
  try {
    cpSync('origins', join(dir, 'origins'), { recursive: true });
    cpSync('scripts', join(dir, 'scripts'), { recursive: true });
    for (const link of ['src', 'package.json', 'node_modules']) symlinkSync(resolve(link), join(dir, link));
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

test('a creature listed by two loot rows is a duplicate-id (the registry loader), at load and in the gate, not a silent last-wins', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loot-dup-'));
  try {
    cpSync('origins', join(dir, 'origins'), { recursive: true });
    cpSync('scripts', join(dir, 'scripts'), { recursive: true });
    for (const link of ['src', 'package.json', 'node_modules']) symlinkSync(resolve(link), join(dir, link));
    const file = join(dir, ROWS_FILE), all = JSON.parse(readFileSync(file, 'utf8')) as Record<string, any>[];
    all.find((t) => t.id === 'loottable:ash-wolf')!.rolledBy.push('character:ember-wolf');
    writeFileSync(file, JSON.stringify(all));
    const gate = spawnSync(process.execPath, ['scripts/registry-check.mjs', 'origins'], { cwd: dir, encoding: 'utf8' });
    assert.equal(gate.status, 1);
    assert.match(gate.stderr, /loot-tables\.json:\d+:character:ember-wolf duplicate-id/);
    writeFileSync(join(dir, 'probe.ts'), "import './origins/region1/content.ts';");
    const run = spawnSync(process.execPath, ['probe.ts'], { cwd: dir, encoding: 'utf8' });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /character:ember-wolf duplicate-id/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a loot row repeating a key is a duplicate-key failure in the gate (raw text), not a silent last-wins', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loot-rawdup-'));
  try {
    cpSync('origins', join(dir, 'origins'), { recursive: true });
    cpSync('scripts', join(dir, 'scripts'), { recursive: true });
    for (const link of ['src', 'package.json', 'node_modules']) symlinkSync(resolve(link), join(dir, link));
    const file = join(dir, ROWS_FILE), text = readFileSync(file, 'utf8');
    writeFileSync(file, text.replace('"presentation": "collect",', '"presentation": "collect", "presentation": "pick",'));
    const gate = spawnSync(process.execPath, ['scripts/registry-check.mjs', 'origins'], { cwd: dir, encoding: 'utf8' });
    assert.equal(gate.status, 1);
    assert.match(gate.stderr, /loot-tables\.json:\d+: duplicate key "presentation"/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a rolledBy that names no character is an unknown-ref in the gate', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loot-ref-'));
  try {
    cpSync('origins', join(dir, 'origins'), { recursive: true });
    cpSync('scripts', join(dir, 'scripts'), { recursive: true });
    for (const link of ['src', 'package.json', 'node_modules']) symlinkSync(resolve(link), join(dir, link));
    const file = join(dir, ROWS_FILE), all = JSON.parse(readFileSync(file, 'utf8')) as Record<string, any>[];
    all.find((t) => t.id === 'loottable:ash-wolf')!.rolledBy = ['character:ghost'];
    writeFileSync(file, JSON.stringify(all));
    const gate = spawnSync(process.execPath, ['scripts/registry-check.mjs', 'origins'], { cwd: dir, encoding: 'utf8' });
    assert.equal(gate.status, 1);
    assert.match(gate.stderr, /character:ghost unknown-ref/);
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
