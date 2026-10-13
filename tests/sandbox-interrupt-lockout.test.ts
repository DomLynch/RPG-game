// sandbox-mech: interruptEarly. The earlier a cast is cut, the longer the caster is locked out (extra lockout in per-mille of the base, scaled by the windup left); 0 = trunk.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const row = DEFS.rules.find((r) => r.id === 'interruptEarly') as { value: number };
const shipped = row.value; row.value = 1000;
const { interruptLockout } = await import('../src/fight/sandbox-rules.ts');

test('trunk ships interruptEarly at 0', () => assert.equal(shipped, 0));
test('a cut at the start doubles the lockout, a cut at half adds half, a cut at release adds nothing', () => {
  assert.equal(interruptLockout(480, 120, 120), 960);
  assert.equal(interruptLockout(480, 60, 120), 720);
  assert.equal(interruptLockout(480, 0, 120), 480);
  assert.equal(interruptLockout(480, 999, 120), 960, 'never more than the start');
});
