import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import rules from '../src/hit-stop-rules.json' with { type: 'json' };
import manifest from '../src/hit-stop-rules.manifest.json' with { type: 'json' };
import { HEAVY_BLOCK, HEAVY_HIT, HIT_STOP } from '../src/hit-stop-rules.ts';
import { readFileSync } from 'node:fs';
import { SIM } from '../eslint.config.js';
import { stopFor } from '../src/hit-stop.ts';
import { KICK, impactStopMs } from '../src/fight/hit-impact.ts';
import type { CombatEvent } from '../src/fight/combat.ts';

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

// stopFor moved out of main.ts to src/hit-stop.ts so scripts/impact-preview.mjs freezes exactly as many frames as the game does.
const ev = (e: Record<string, unknown>) => ({ tick: 1, actor: 0, target: 1, ...e }) as unknown as CombatEvent;
test('stopFor: the rows plus the impact tier, heavy contacts stop longer, a landed kick is its own beat, nothing is nothing', () => {
  assert.equal(stopFor([]), 0);
  const hit = [ev({ type: 'Hit', move: 'light_left' })], heavy = [ev({ type: 'Hit', move: 'heavy_overhead' })], blocked = [ev({ type: 'Blocked', move: 'heavy_riposte' })];
  assert.equal(stopFor(hit), HIT_STOP.Hit! + impactStopMs(hit));
  assert.equal(stopFor(heavy), HEAVY_HIT + impactStopMs(heavy));
  assert.equal(stopFor(blocked), HEAVY_BLOCK + impactStopMs(blocked));
  assert.equal(stopFor([ev({ type: 'Hit', move: 'light_left', charged: true })]), HEAVY_HIT + impactStopMs([ev({ type: 'Hit', move: 'light_left', charged: true })]));
  assert.equal(stopFor([ev({ type: 'SpecialLanded' })]), HIT_STOP.SpecialLanded!);
  assert.equal(stopFor([ev({ type: 'Hit', move: 'kick' })]), KICK.stopMs);
  assert.ok(stopFor(heavy) > stopFor(hit));
});

test('impact-preview freezes with the game\'s own stopFor, not a copy of the table', () => {
  const src = readFileSync(new URL('../scripts/impact-preview.mjs', import.meta.url), 'utf8');
  assert.match(src, /import \{ stopFor \} from '\/src\/hit-stop\.ts'/);
  assert.doesNotMatch(src, /GuardBroken: 90|PostureBroken: 1\d\d/, 'no second copy of the stop table');
});
