// Loot tables are ROWS (origins/region1/loot-tables.json): same bytes as the old code, every row is contract-checked, and a new table is one row, no code.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
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
  assert.equal(createHash('sha256').update(JSON.stringify(BUNDLE)).digest('hex'), 'c01962f2afb383baa0757734ea4afba0fcf82ea9221a837aa0310685b46ef9bc');   // re-pinned 2026-10-22 (Backend, Dungeon 1 legend rotation, Lead's ruling): zone 7's nine camps in the bundle's region are rotating camps (pool of three per ring); the sha before it was 634ed5fca16e8829dd4acf95e06bfa4ab8a54310df69def2556f98b2bc2f5ff7; re-pinned again 2026-10-22 (Dungeon 1, Combat): the bundle's region carries zone 7's camps, whose roster pool moved to the four families the world draws a body for; the sha before it afc1b8cbc92ec77eccc5514e143c0866aff5384542ee5d79cd8b1cb50cd77d40   // re-pinned 2026-10-22 (Dungeon 1, Combat): loottable:pit-legend (the one shared table the Pit's legends roll) and the 100 legend characters derived from the legend tables (origins/region1/legend-foes.ts) join the bundle; the sha before it b4c28b961c293a494307c578f9d624d1dafbd26c84090305b9ef73eab45c6385   // re-pinned 2026-10-22 (#3558, Zone 2 creatures: loottable:ruin-ghoul is also rolledBy the Ash skeleton and the Pale duelist, a placeholder until Characters' loot; the sha before it 3ee7049d4efcb89b9c94fc47fad0f3aac11b3415092d540e11e6a47c7bdda682); re-pinned 2026-10-21 (#3497 creature mix: +4 spawn rows and +4 spawn-only waypoints in Zone 1's place; the sha before it d32451630fb0c72af6aa3891279ef8c1eee40311cc86bbbc4b6b1a66882dd8c2); re-pinned 2026-10-20 (World, the shrine salamander camp moves to the new shrine-field waypoint; the sha before it a1852e12fbb1e718d2b335ea468cd26fb13b0eb4f951c0589d5e8e39edc1f762); earlier note: re-pinned 2026-10-20 (World, #3392: Zone 1 bear and salamander respawnSeconds 75/90 -> 60 and four giant-salamander camps in its spawns, Lead's rulings; the sha before it 5dfb4b36e50d1b65…); earlier: re-pinned 2026-10-19 (RV82 content: +starter.Bow / starter.Staff, the lootStarter slots and their item rows; the sha before it was cd50b0b9…); earlier: (Dom: everything from the sandbox moves over; Zone 1's loottable:cave-troll takes the pitborn Greaves/Boots roll of loottable:tz-cave-troll; the sha before it 236d16ceadb9148e). Earlier: re-pinned 2026-10-18 (fix-forward, +loottable:tz-cave-troll for zone 90's troll row; the sha before it 51086283eebc26be54f6b4385f4fded8ba3d93a4edc77bca55dd7f30ec015406, which this file's table removal restores). Earlier: re-pinned 2026-10-17 (fix-forward, the beta dungeon's door #3016, merged over lootStarter): +waypoint cave-mouth in Zone 1's row, the sha before it 7db299d53556b7f9a2f9aa861c05e4454658c93ffff383c9790e9abf140e14e0;   // re-pinned 2026-10-17 (fix-forward, lootStarter): +item:loot.starter.Longsword in the catalogue slice of BUNDLE, was 7715bd7b…; expected to be the only change (not hash-checked: BUNDLE without the item was not hashed back to 7715bd7b…)   // re-pinned 2026-10-16 again (fix-forward, #2878 on top of the troll camp move #2877: +loottable:giant-salamander and the troll-cave waypoint; alone 6234f66f... and cb29b740...; the sha before it a5d22a9629fed8b943e855ed6f92382b7a779b616dc7f83962cd136895ca5874); re-pinned 2026-10-16 (fix-forward, the Cave Troll placement #2877: +loottable:cave-troll in the rows; the sha before it dca296315736308700aa4f32bbf611ada78c281115a1e9615a38c552df4dd2d0); re-pinned 2026-10-15 (three times; the third gain is the goblin scrap cap and shin plates, the sha before it ff73583edfed91007d8a5e8d9955449ef3f196885a2a0e1c03023a27c69bb73a; earlier: the second gain is the knife, cleaver, gladius and estoc starter items, the sha before it 085baf4d40d4db76ad0eddbf95180a7df1d36af45529d58193da9e30332ecda7): BUNDLE gained exactly one item, item:starter.rusty-sword (ground loot slice 1). The old pin 37812f68... is what the bundle hashes to WITHOUT that item (checked on the VPS).
  assert.equal(LOOT_TABLES.length, 16);   // 15 before loottable:pit-legend (2026-10-22, Dungeon 1: the Pit's legends' shared table); 14 before loottable:tz-cave-troll (2026-10-18);   // + loottable:cave-troll and loottable:giant-salamander (2026-10-16, the Cave Troll and Giant Salamander placements)
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
