import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/pack-rows.ts';

// pack.ts's named numbers are rows (pack-defs.json); the values must be exactly the literals the file held before.
test('pack rows give exactly the numbers pack.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"THREAT_MAX": 7, "SWITCH_MELEE": 1.1, "SWITCH_CASTER": 1.3});
});
