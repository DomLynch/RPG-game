// sandbox-mech: spell slot 2. A fighter may carry a second spell (SPELL 2): the 'skill2' press casts it with its own cooldown and its own cost, the slot-1 spell is back when the cast ends, and a fighter with no second spell refuses the press.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const rule = (id: string) => (DEFS as unknown as { rules: { id: string; value: number }[] }).rules.find((r) => r.id === id)!;
rule('manaMax').value = 100; rule('manaRegen').value = 60; rule('manaDelay').value = 90; rule('manaCostMult').value = 1000;
const { createFighter, stepDuel, idleIntent, legal } = await import('../src/fight/duel.ts');
const idle = () => ({ ...idleIntent(), lock: false });
const spell = (id: string, cost: number) => ({ id, cost, school: 'fire', skill: 40 }) as never;
const caster = (extra: object = {}) => ({ ...createFighter({ x: 0, z: 1.2, heading: Math.PI, distance: 0 }, 'ready'), specialShare: 0.1, skillCooldown: 0, skill: 'shove' as never, spell: spell('one', 20), spell2: spell('two', 35), ...extra });
const duelOf = (c: object) => ({ tick: 0, fighters: [c, createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] }) as never as { fighters: { mana: number; special?: number; spell?: { id: string }; skillCooldown: number; skillCooldown2?: number; slot2Active?: boolean }[]; events: { type: string; spell?: string }[] };

test('a fighter with a second spell may press SPELL 2, and one without may not', () => {
  assert.equal(legal(caster() as never, 'skill2'), true);
  const { spell2: _drop, ...none } = caster() as Record<string, unknown>;
  assert.equal(legal(none as never, 'skill2'), false);
});
test('SPELL 2 is paid with its own cost (35 mana) and casts the second spell', () => {
  let d = duelOf(caster());
  d = stepDuel(d as never, [{ ...idle(), action: 'skill2' }, idle()]) as never;
  assert.equal(d.fighters[0]!.mana, 65);
  assert.equal(d.fighters[0]!.spell?.id, 'two', 'the second spell is the one being cast');
  assert.equal(d.events.find((e) => e.type === 'SpecialStarted')?.spell, 'two');
});
test('the slot-1 spell is back when the cast ends, and only the second slot cooled down', () => {
  let d = duelOf(caster());
  d = stepDuel(d as never, [{ ...idle(), action: 'skill2' }, idle()]) as never;
  for (let i = 0; i < 200; i++) d = stepDuel(d as never, [idle(), idle()]) as never;
  assert.equal(d.fighters[0]!.spell?.id, 'one', 'slot 1 restored');
  assert.equal(d.fighters[0]!.slot2Active, undefined);
  assert.ok((d.fighters[0]!.skillCooldown2 ?? 0) > 0, 'slot 2 is cooling');
  assert.equal(d.fighters[0]!.skillCooldown, 0, 'slot 1 is untouched');
  assert.equal(legal(d.fighters[0] as never, 'skill2'), false, 'SPELL 2 waits for its cooldown');
  assert.equal(legal({ ...d.fighters[0], phase: 'ready', special: 0, specialRecover: 0, mana: 100 } as never, 'skill'), true, 'SPELL 1 is still ready');
});
