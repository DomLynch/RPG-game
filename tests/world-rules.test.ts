// The world-combat rules are rows (src/fight/world-rules-defs.json): every default equals the literal it replaced, the loader refuses a broken table, and a new row is one entry.
import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD_RULES, loadWorldRules, worldRule } from '../src/fight/world-rules.ts';
import { ENGAGE_M, ENGAGE_OUT_M, HOLD_M, PROTECT_LEVEL, MAX_LEVEL_GAP, AGGRO_WINDOW_S, PLAYER_RADIUS } from '../src/fight/world.ts';
import { AGGRO_M } from '../src/fight/threat.ts';
import { JOIN_M, DROP_M, FALL_S, PULSE_S, MAX_STEPS } from '../src/fight/world-combat.ts';
import { TUNING } from '../src/core/world-sim.ts';
import DEFS from '../src/fight/world-rules-defs.json' with { type: 'json' };

test('every world rule equals the literal it replaced', () => {
  assert.deepEqual([ENGAGE_M, ENGAGE_OUT_M, HOLD_M, PROTECT_LEVEL, MAX_LEVEL_GAP, AGGRO_WINDOW_S, PLAYER_RADIUS], [4, 6, 4 * 0.95, 3, 10, 60, 0.425]);
  assert.deepEqual([JOIN_M, DROP_M, FALL_S, PULSE_S, MAX_STEPS], [AGGRO_M + 3, AGGRO_M + 8, 1.4, 0.18, 15]);
  assert.deepEqual([TUNING.aggro, TUNING.aggroNamed, TUNING.hold], [7, 9, 1.5]);   // the creature notice rings (src/core/world-sim.ts) read their rows
  assert.equal(WORLD_RULES.length, 15);
});
test('the loader refuses a missing named rule, a non-positive value, a duplicate id, an engageOut below engage, a holdFactor above 1; a new row is one entry', () => {
  const rows = DEFS.rules;
  assert.throws(() => loadWorldRules({ rules: rows.filter((r) => r.id !== 'engage') }), /"engage" rule by name/);
  assert.throws(() => loadWorldRules({ rules: rows.map((r) => (r.id === 'fall' ? { ...r, value: 0 } : r)) }), /value is a number > 0/);
  assert.throws(() => loadWorldRules({ rules: [...rows, rows[0]!] }), /duplicate|twice|unique/i);
  assert.throws(() => loadWorldRules({ rules: rows.map((r) => (r.id === 'engageOut' ? { ...r, value: 3 } : r)) }), /hysteresis/);
  assert.throws(() => loadWorldRules({ rules: rows.map((r) => (r.id === 'holdFactor' ? { ...r, value: 1.2 } : r)) }), /holdFactor/);
  assert.equal(loadWorldRules({ rules: [...rows, { id: 'extra', value: 2, unit: 'm' }] }).length, 16);
  assert.equal(worldRule('engage'), 4);
});
