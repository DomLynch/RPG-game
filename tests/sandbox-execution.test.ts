// sandbox-mech: execution. A critical blow (the heavy thrown after a posture break) hits executeMult per-mille of its damage and finishes a foe at or under executeBelow percent; both 0 = trunk.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const row = (id: string) => DEFS.rules.find((r) => r.id === id) as { value: number };
const shipped = [row('executeMult').value, row('executeBelow').value];
row('executeMult').value = 1500; row('executeBelow').value = 25;
const { executed } = await import('../src/fight/sandbox-rules.ts');

test('trunk ships execution off', () => assert.deepEqual(shipped, [0, 0]));
test('a critical blow is 1.5x; a plain blow is untouched', () => {
  assert.equal(executed(20, true, 150, 150), 30);
  assert.equal(executed(20, false, 150, 150), 20);
});
test('a critical blow on a foe at or under 25% finishes them; over 25% does not', () => {
  assert.equal(executed(20, true, 37, 150), 37, 'at 24.7%: the blow takes all that is left');
  assert.equal(executed(20, true, 38, 150), 30, 'at 25.3%: over the line, so only the 1.5x');
});
