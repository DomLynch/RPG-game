// Resource pools as an open registry (RV43): defaults equal what the duel always used, a row's own pools reach the fighter, and a NEW pool is one data row with no code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, OPPONENTS } from '../src/fight/moves.ts';
import { createFighter, opponentFighter } from '../src/fight/duel.ts';
import { readFileSync } from 'node:fs';
import { POOLS, loadPoolDefs, poolProblems, poolsOf } from '../src/fight/pools.ts';

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
test('adding a pool is ONE data row in pool-defs.json: a test \'intelligence\' row goes through the real loader and resolves, validates and defaults with no code and no schema edit', () => {
  const raw = JSON.parse(readFileSync(new URL('../src/fight/pool-defs.json', import.meta.url), 'utf8')) as { pools: unknown[] };
  assert.deepEqual(loadPoolDefs(raw), POOLS, 'the shipped table loads to POOLS');
  const defs = loadPoolDefs({ pools: [...raw.pools, { id: 'intelligence', default: 10, min: 0, max: 100, sim: false }] });
  assert.equal(poolsOf({ health: 150 }, undefined, defs).intelligence, 10, 'unnamed: the definition\'s default');
  assert.equal(poolsOf({ health: 150 }, { intelligence: 14 }, defs).intelligence, 14, 'a row names it');
  assert.deepEqual(poolProblems({ intelligence: 14 }, defs), []);
  assert.equal(poolProblems({ intelligence: 140 }, defs).length, 1, 'above max');
  assert.equal(poolProblems({ intelligence: 14 }).length, 1, 'without its definition row it is refused, never silently accepted');
  assert.deepEqual(Object.keys(poolsOf({ health: 150 }, undefined, defs)), ['health', 'stamina', 'mana', 'focus', 'intelligence']);
});
test('the loader refuses a duplicate id, a missing field, a mistyped field, a default below min, and a table without health or stamina', () => {
  const ok = { id: 'x', default: 1, min: 0, sim: false }, base = [{ id: 'health', default: 150, min: 1, sim: true }, { id: 'stamina', default: 100, min: 1, sim: true }];
  assert.doesNotThrow(() => loadPoolDefs({ pools: [...base, ok] }));
  assert.throws(() => loadPoolDefs({ pools: [...base, ok, ok] }), /duplicate pool "x"/);
  assert.throws(() => loadPoolDefs({ pools: [...base, { id: 'x', default: 1, min: 0 }] }), /sim is true or false/);
  assert.throws(() => loadPoolDefs({ pools: [...base, { id: 'x', default: '1', min: 0, sim: false }] }), /default and min are numbers/);
  assert.throws(() => loadPoolDefs({ pools: [...base, { id: 'x', default: 0, min: 1, sim: false }] }), /default >= min/);
  assert.throws(() => loadPoolDefs({ pools: [...base, { id: 'x', default: 5, min: 0, max: 2, sim: false }] }), /max is a number >= default/);
  assert.throws(() => loadPoolDefs({ pools: [{ id: 'health', default: 150, min: 1, sim: true }] }), /"stamina"/);
  assert.throws(() => loadPoolDefs({ pools: [...base, { default: 1, min: 0, sim: false }] }), /id is a non-empty string/);
});
test('pool problems: an unknown pool, a non-finite value, below min, a zero stamina bar', () => {
  assert.equal(poolProblems({ rage: 5 }).length, 1);
  assert.equal(poolProblems({ stamina: Number.NaN }).length, 1);
  assert.equal(poolProblems({ stamina: 0 }).length, 1);
  assert.equal(poolProblems({ mana: -1 }).length, 1);
  assert.deepEqual(poolProblems({ health: 90, stamina: 120, mana: 0, focus: 5 }), []);
  assert.deepEqual(poolProblems(undefined), []);
});
