// sandbox-mech: commit vs bait. A `commit` row makes a weapon's move a commitment: longer windup, no feint, and the poise shrug from its first tick. No rows (trunk) = untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const d = DEFS as unknown as { commit: { weapon: string; move: string; windup: number }[] };
const shipped = d.commit.length;
const baseline = (await import('../src/fight/duel.ts')).timing;   // read before the rows exist
const { createFighter, feintable } = await import('../src/fight/duel.ts');
const mk = (weapon: string) => ({ ...createFighter({ x: 0, z: 0, heading: 0, distance: 0 } as never, 'attack', weapon as never), move: 'heavy_overhead' as never, age: 2 });
const before = baseline(mk('maul')).windup;
d.commit.push({ weapon: 'maul', move: 'heavy_overhead', windup: 30 });
const { commitOf } = await import('../src/fight/sandbox-rules.ts');

test('trunk ships commit off', () => assert.equal(shipped, 0));
test('only the named weapon and move is a commitment', () => {
  assert.ok(commitOf('maul', 'heavy_overhead'));
  assert.equal(commitOf('maul', 'thrust'), undefined);
  assert.equal(commitOf('longsword', 'heavy_overhead'), undefined);
  assert.equal(commitOf('maul', null), undefined);
});
test('a committed swing cannot be feinted; an ordinary heavy still can', () => {
  assert.equal(feintable(mk('maul')), false);
  assert.equal(feintable(mk('longsword')), true);
});
test('a committed swing has the longer windup (30%)', async () => {
  const { timing } = await import('../src/fight/duel.ts');
  assert.equal(timing(mk('maul')).windup, before + Math.round((before * 30) / 100));
});
