// sandbox-mech: castPenalty. Armour weight adds a percent of the windup to a special's cast time, read off the sheet's dials; no rows = the plain windup (trunk).
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const defs = DEFS as unknown as { castPenalty: unknown[] };
const shipped = defs.castPenalty.length;
defs.castPenalty = [{ id: 'heavy', dial: 'armour', atLeast: 20, percent: 20 }, { id: 'medium', dial: 'stamina', atLeast: 20, percent: 10 }];
const { castWindup } = await import('../src/fight/sandbox-rules.ts');

test('trunk ships no castPenalty rows', () => assert.equal(shipped, 0));
test('plate +20%, leathers +10%, robes and no sheet 0; the heaviest matching row wins', () => {
  assert.equal(castWindup({ armour: 25, magicResist: -15, stamina: -10 }, 120), 144);
  assert.equal(castWindup({ stamina: 25, armour: -25 }, 120), 132);
  assert.equal(castWindup({ magicResist: 25, armour: -25 }, 120), 120);
  assert.equal(castWindup(undefined, 120), 120);
  assert.equal(castWindup({ armour: 30, stamina: 30 }, 120), 144);
});
