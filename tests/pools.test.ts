// Resource pools as data (RV43): defaults equal what the duel always used, a row's own pools reach the fighter, mana and focus are data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, OPPONENTS } from '../src/fight/moves.ts';
import { createFighter, opponentFighter } from '../src/fight/duel.ts';
import { STAMINA_START, poolsOf } from '../src/fight/pools.ts';

const body = { x: 0, z: 0, heading: 0, distance: 0 };

test('the defaults are today\'s numbers: stamina 100, health RULES.health, mana and focus 0', () => {
  assert.equal(STAMINA_START, 100);
  assert.deepEqual(poolsOf(RULES.health), { health: RULES.health, stamina: 100, mana: 0, focus: 0 });
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
test('a row\'s own pools reach the fighter: health and stamina set the bars and their ceilings; unnamed pools keep the default', () => {
  const f = opponentFighter({ ...OPPONENTS.goblin, pools: { stamina: 140, health: 77 } }, body);
  assert.deepEqual([f.health, f.maxHealth, f.stamina, f.maxStamina], [77, 77, 140, 140]);
  const g = opponentFighter({ ...OPPONENTS.goblin, pools: { stamina: 60 } }, body);
  assert.deepEqual([g.health, g.stamina, g.maxStamina], [OPPONENTS.goblin.health, 60, 60], 'health not named: the row health stands');
  assert.deepEqual(poolsOf(10, { mana: 30, focus: 5 }), { health: 10, stamina: 100, mana: 30, focus: 5 }, 'mana and focus are carried as data');
  assert.equal('mana' in createFighter(body, 'ready', 'longsword', 1, 0, 100, undefined, 1, 1, 'hero', { mana: 30 }), false, 'the Fighter has no mana field (hashed state is unchanged)');
});
