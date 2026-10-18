// sandbox-mech: mana. With `manaMax` on, a spell is paid in mana (not stamina) at the commit, is refused short of it, and mana regenerates when idle, slower in heavy armour. manaMax 0 (trunk) = the spell costs stamina.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const rule = (id: string) => (DEFS as unknown as { rules: { id: string; value: number }[] }).rules.find((r) => r.id === id)!;
const shipped = [rule('manaMax').value, rule('manaRegen').value];
const cp = (DEFS as unknown as { castPenalty: unknown[] }).castPenalty; cp.push({ id: 'heavy', dial: 'armour', atLeast: 20, percent: 20 });
rule('manaMax').value = 100; rule('manaRegen').value = 60; rule('manaDelay').value = 90; rule('manaCostMult').value = 1500;
const { createFighter, stepDuel, idleIntent, legal } = await import('../src/fight/duel.ts');
const { manaCost, manaRegenPerTick } = await import('../src/fight/sandbox-rules.ts');
const idle = () => ({ ...idleIntent(), lock: false });

const caster = (mana = 100) => ({ ...createFighter({ x: 0, z: 1.2, heading: Math.PI, distance: 0 }, 'ready'), specialShare: 0.1, skill: 'shove' as never, spell: { id: 'bird-jaguar', cost: 20, school: 'fire', skill: 40 } as never, mana });
const duelOf = (c: ReturnType<typeof caster>) => ({ tick: 0, fighters: [c, createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] }) as never as { fighters: { mana: number; stamina: number; manaRest?: number; special?: number }[] };

test('trunk ships mana off', () => assert.deepEqual(shipped, [0, 0]));
test('a fighter carries a third bar of 100', () => assert.equal(duelOf(caster()).fighters[0]!.mana, 100));
test('the cost is the spell\'s stamina cost times the row (20 x 1.5 = 30)', () => assert.equal(manaCost(20), 30));
test('a spell is refused short of its mana even with full stamina, and allowed at the cost', () => {
  assert.equal(legal(caster(29) as never, 'skill'), false);
  assert.equal(legal(caster(30) as never, 'skill'), true);
});
test('casting spends mana, leaves stamina alone, and starts the regen delay', () => {
  let d = duelOf(caster(100)); const stamina = d.fighters[0]!.stamina;
  d = stepDuel(d as never, [{ ...idle(), action: 'skill' }, idle()]) as never;
  assert.equal(d.fighters[0]!.special! > 0, true, 'the cast started');
  assert.equal(d.fighters[0]!.mana, 70);
  assert.equal(d.fighters[0]!.stamina, stamina);
  assert.equal(d.fighters[0]!.manaRest! > 0, true);
});
test('mana regenerates when idle after the delay: 6 a second', () => {
  let d = duelOf({ ...caster(40), manaRest: 90 } as never);   // just cast: the delay is running
  for (let i = 0; i < 90; i++) d = stepDuel(d as never, [idle(), idle()]) as never;
  const before = d.fighters[0]!.mana; assert.equal(before, 40, 'nothing during the delay');
  for (let i = 0; i < 60; i++) d = stepDuel(d as never, [idle(), idle()]) as never;
  assert.ok(Math.abs(d.fighters[0]!.mana - 46) < 0.2, `about 46, got ${d.fighters[0]!.mana}`);
});
test('heavy armour slows the regen by the casting penalty, not the cost', () => {
  const plain = manaRegenPerTick(undefined), plate = manaRegenPerTick({ armour: 25 } as never);
  assert.ok(Math.abs(plain - 0.1) < 1e-9);
  assert.ok(Math.abs(plate - 0.1 * (100 / 120)) < 1e-9);
  assert.equal(manaCost(20), 30);
});
