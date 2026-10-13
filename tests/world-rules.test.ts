// The world-combat rules are rows (src/fight/world-rules-defs.json): every default equals the literal it replaced, the loader refuses a broken table, and a new row is one entry.
import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD_RULES, loadWorldRules, worldRule } from '../src/fight/world-rules.ts';
import { ENGAGE_M, ENGAGE_OUT_M, HOLD_M, PROTECT_LEVEL, MAX_LEVEL_GAP, AGGRO_WINDOW_S, PLAYER_RADIUS } from '../src/fight/world.ts';
import { AGGRO_M } from '../src/fight/threat.ts';
import { JOIN_M, DROP_M, FALL_S, PULSE_S, MAX_STEPS } from '../src/fight/world-combat.ts';
import { SPEEDS, LEASH } from '../src/fight/speeds.ts';
import { RUN_SPEED } from '../origins/world/zone-rules.ts';
import { RARE_DEFAULT, CAMP_MAX, BOSS_CAMP_MAX } from '../src/core/world/row.ts';
import { TUNING } from '../src/core/world-sim.ts';
import { readFileSync } from 'node:fs';
import DEFS from '../src/fight/world-rules-defs.json' with { type: 'json' };

test('every world rule equals the literal it replaced', () => {
  assert.deepEqual([ENGAGE_M, ENGAGE_OUT_M, HOLD_M, PROTECT_LEVEL, MAX_LEVEL_GAP, AGGRO_WINDOW_S, PLAYER_RADIUS], [4, 6, 4 * 0.95, 3, 10, 60, 0.425]);
  assert.deepEqual([JOIN_M, DROP_M, FALL_S, PULSE_S, MAX_STEPS], [AGGRO_M + 3, AGGRO_M + 8, 1.4, 0.18, 15]);
  assert.deepEqual([TUNING.aggro, TUNING.aggroNamed, TUNING.hold], [7, 9, 1.5]);   // the creature notice rings (src/core/world-sim.ts) read their rows
  assert.deepEqual([SPEEDS.player.walk, SPEEDS.player.run, SPEEDS.creature.amble, SPEEDS.creature.chase, LEASH.default, RUN_SPEED], [2.3, 5.2, 0.9, 4.5, 30, 5.2]);   // the speed table and the leash read their rows
  assert.deepEqual([RARE_DEFAULT, CAMP_MAX, BOSS_CAMP_MAX], [0.05, 4, 6]);   // the camp numbers read their rows
  assert.equal(WORLD_RULES.length, 24);
});
test('the loader refuses a missing named rule, a non-positive value, a duplicate id, an engageOut below engage, a holdFactor above 1; a new row is one entry', () => {
  const rows = DEFS.rules;
  assert.throws(() => loadWorldRules({ rules: rows.filter((r) => r.id !== 'engage') }), /"engage" rule by name/);
  assert.throws(() => loadWorldRules({ rules: rows.map((r) => (r.id === 'fall' ? { ...r, value: 0 } : r)) }), /value is a number > 0/);
  assert.throws(() => loadWorldRules({ rules: [...rows, rows[0]!] }), /duplicate|twice|unique/i);
  assert.throws(() => loadWorldRules({ rules: rows.map((r) => (r.id === 'engageOut' ? { ...r, value: 3 } : r)) }), /hysteresis/);
  assert.throws(() => loadWorldRules({ rules: rows.map((r) => (r.id === 'holdFactor' ? { ...r, value: 1.2 } : r)) }), /holdFactor/);
  assert.equal(loadWorldRules({ rules: [...rows, { id: 'extra', value: 2, unit: 'm' }] }).length, 25);
  assert.equal(worldRule('engage'), 4);
});
test('the Pit sim keeps its own run literal (a Pit sim file: editing it would force a RECORD_VERSION bump); it must equal the playerRun row', () => {
  const m = /input\.run \? ([0-9.]+) :/.exec(readFileSync(new URL('../src/fight/sim.ts', import.meta.url), 'utf8'));
  assert.ok(m, 'src/fight/sim.ts advance() no longer has the `input.run ? <n> :` literal: point this test at the new shape');
  assert.equal(Number(m![1]), worldRule('playerRun'), 'sim.ts run speed and the playerRun row drifted: change both together under a RECORD_VERSION bump');
});
