// Resource pools as an open registry (RV43): defaults equal what the duel always used, a row's own pools reach the fighter, and a NEW pool is one data row with no code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, OPPONENTS } from '../src/fight/moves.ts';
import { createFighter, opponentFighter } from '../src/fight/duel.ts';
import { POOLS, poolProblems, poolsOf, type PoolDef } from '../src/fight/pools.ts';

const body = { x: 0, z: 0, heading: 0, distance: 0 };
const def = (id: string) => POOLS.find((d) => d.id === id);

test('the definitions are today\'s numbers: health RULES.health, stamina 100, mana and focus 0; health and stamina exist (the sim reads them by name)', () => {
  assert.equal(def('health')!.default, RULES.health);
  assert.equal(def('stamina')!.default, 100);
  assert.deepEqual([def('mana')!.default, def('focus')!.default], [0, 0]);
  const f = createFighter(body, 'ready');
  assert.deepEqual([f.health, f.maxHealth, f.stamina, f.maxStamina], [RULES.health, RULES.health, 100, 100]);
});
test('every roster opponent without pools starts exactly as before: its row health, stamina 100', () => {
  for (const o of Object.values(OPPONENTS)) {
    assert.equal(o.pools, undefined, `${o.id}: no roster row names pools yet`);
    const f = opponentFighter(o, body);
    assert.deepEqual([f.health, f.maxHealth, f.stamina, f.maxStamina], [o.health, o.health, 100, 100], o.id);
  }
});
test('a row\'s own pools reach the fighter: health and stamina set the bars and their ceilings; an unnamed pool keeps its default', () => {
  const f = opponentFighter({ ...OPPONENTS.goblin, pools: { stamina: 140, health: 77 } }, body);
  assert.deepEqual([f.health, f.maxHealth, f.stamina, f.maxStamina], [77, 77, 140, 140]);
  const g = opponentFighter({ ...OPPONENTS.goblin, pools: { stamina: 60 } }, body);
  assert.deepEqual([g.health, g.stamina, g.maxStamina], [OPPONENTS.goblin.health, 60, 60], 'health not named: the row health stands');
  assert.equal('mana' in createFighter(body, 'ready', 'longsword', 1, 0, 100, undefined, 1, 1, 'hero', { mana: 30 }), false, 'the Fighter has no mana field (hashed state is unchanged)');
});
test('adding a pool is ONE data row: a test \'intelligence\' pool resolves, validates and defaults with no code and no schema edit', () => {
  const intelligence: PoolDef = { id: 'intelligence', default: 10, min: 0, max: 100 };
  const defs = [...POOLS, intelligence];
  assert.equal(poolsOf({ health: 150 }, undefined, defs).intelligence, 10, 'unnamed: the definition\'s default');
  assert.equal(poolsOf({ health: 150 }, { intelligence: 14 }, defs).intelligence, 14, 'a row names it');
  assert.deepEqual(poolProblems({ intelligence: 14 }, defs), []);
  assert.deepEqual(poolProblems({ intelligence: 140 }, defs).length, 1, 'above max');
  assert.deepEqual(poolProblems({ intelligence: 14 }).length, 1, 'with no definition row it is refused (not silently accepted)');
  assert.deepEqual(Object.keys(poolsOf({ health: 150 }, undefined, defs)), ['health', 'stamina', 'mana', 'focus', 'intelligence']);
});
test('pool problems: an unknown pool, a non-finite value, below min, a zero stamina bar', () => {
  assert.equal(poolProblems({ rage: 5 }).length, 1);
  assert.equal(poolProblems({ stamina: Number.NaN }).length, 1);
  assert.equal(poolProblems({ stamina: 0 }).length, 1);
  assert.equal(poolProblems({ mana: -1 }).length, 1);
  assert.deepEqual(poolProblems({ health: 90, stamina: 120, mana: 0, focus: 5 }), []);
  assert.deepEqual(poolProblems(undefined), []);
});
