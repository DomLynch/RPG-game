import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import rules from '../src/hit-stop-rules.json' with { type: 'json' };
import manifest from '../src/hit-stop-rules.manifest.json' with { type: 'json' };
import { HEAVY_BLOCK, HEAVY_HIT, HIT_STOP } from '../src/hit-stop-rules.ts';
import { SIM } from '../eslint.config.js';

test('hit-stop rules: the table and the heavy pair are exactly the numbers main.ts held in code (ms)', () => {
  assert.deepEqual(HIT_STOP, { SpecialLanded: 50, Blocked: 30, Hit: 50, Parried: 70, GuardBroken: 90, PostureBroken: 150, Killed: 220 });
  assert.deepEqual([HEAVY_HIT, HEAVY_BLOCK], [90, 50]);
});

test('hit-stop rules: the file loads through the registry under its manifest', () => {
  const tables = manifest.tables.map((t) => tableFromFile(t as unknown as Manifest, rules, 'hit-stop-rules.json'));
  assert.doesNotThrow(() => loadRegistry(tables));
});

test('hit-stop rules: presentation only, the simulation never reads them', () => {
  assert.ok(!SIM.includes('src/hit-stop-rules.ts'), 'hit-stop-rules.ts is not a SIM module');
});
