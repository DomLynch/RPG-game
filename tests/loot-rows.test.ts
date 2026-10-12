// Loot tables are ROWS (origins/region1/loot-tables.json): same bytes as the old code, every row is contract-checked, and a new table is one row, no code.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BUNDLE, LOCAL, LOOT_TABLES } from '../origins/region1/content.ts';
import { loadRegion1, type Local } from '../origins/region1/load.ts';
import { REGION1_WORLD } from '../origins/region1/world.ts';
import { onDataPath } from '../scripts/lib/data-only.mjs';

const ROWS_FILE = 'origins/region1/loot-tables.json';
const rows = (): Record<string, any>[] => JSON.parse(readFileSync(ROWS_FILE, 'utf8'));

test('the rows file is on the data path, and BUNDLE is byte-identical to what the code built (key order included)', () => {
  assert.ok(onDataPath(ROWS_FILE));
  assert.equal(createHash('sha256').update(JSON.stringify(BUNDLE)).digest('hex'), '37812f688d80fc18b2947082f7ff9783825adff08d8a868637126d14f8efe207');
  assert.equal(LOOT_TABLES.length, 12);
});

test('a new loot table is one row: it loads through the contracts, and a creature can roll it', () => {
  const row = structuredClone(rows().find((t) => t.id === 'loottable:ember-wolf')!);
  row.id = 'loottable:zone-test-new';
  const local = structuredClone(LOCAL) as Local;
  (local.creatureLoot as Record<string, string>)['character:ember-wolf'] = row.id;
  const r = loadRegion1(REGION1_WORLD, [...structuredClone(BUNDLE).filter((b) => b.id !== 'loottable:ember-wolf'), row], local);   // the Ember Wolf now rolls the new row
  assert.ok(r.ok, JSON.stringify(!r.ok && r.issues, null, 1));
});

test('a row that breaks the contract is refused, and a row nothing rolls is refused (no dead tables)', () => {
  const bad = structuredClone(rows().find((t) => t.id === 'loottable:ember-wolf')!);
  bad.id = 'loottable:zone-test-bad';
  bad.presentation = 'nonsense';
  assert.ok(!loadRegion1(REGION1_WORLD, [...structuredClone(BUNDLE), bad], LOCAL).ok);
  const dead = structuredClone(rows().find((t) => t.id === 'loottable:ember-wolf')!);
  dead.id = 'loottable:zone-test-dead';
  const r = loadRegion1(REGION1_WORLD, [...structuredClone(BUNDLE), dead], LOCAL);
  assert.ok(!r.ok && r.issues.some((i) => i.code === 'rule-violation'));
});
