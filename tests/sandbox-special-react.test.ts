// sandbox specialMeleeWindup + specialReact, switched ON for this process only (the rows ship off): a MELEE special (no spell) is committed for the row's ticks (a heavy swing's pace, not the spell's 2 s) and, when it lands,
// staggers, shoves and shakes the victim by its move row like a landed blow. Donor: the combat sandbox (tests/sandbox-special-react.test.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const rule = (id: string) => (DEFS as unknown as { rules: { id: string; value: number }[] }).rules.find((r) => r.id === id)!;
rule('specialMeleeWindup').value = 32; rule('specialReact').value = 1;
const { createFighter, stepDuel, idleIntent } = await import('../src/fight/duel.ts');
const idle = () => ({ ...idleIntent(), lock: false });
type D = { fighters: { special?: number; phase: string; stun: number; health: number; posture: number; body: { z: number } }[]; events: { type: string }[] };
const duelOf = (skill: string) => ({ tick: 0, fighters: [{ ...createFighter({ x: 0, z: 1.2, heading: Math.PI, distance: 0 }, 'ready'), specialShare: 0.1, skillCooldown: 0, skill: skill as never, picked: true as const }, createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] }) as never as D;

test('a melee special is committed for the row\'s windup, not the spell windup', () => {
  const d = stepDuel(duelOf('cleave') as never, [{ ...idle(), action: 'skill' }, idle()]) as never as D;
  assert.ok((d.fighters[0]!.special ?? 0) > 0 && (d.fighters[0]!.special ?? 0) <= 33, `committed for ${d.fighters[0]!.special} ticks`);
});

test('a class special (not picked) keeps the trunk windup and no react, whatever the rows say: the four picker ids are class-skill ids too', () => {
  const d = duelOf('cleave') as never as D; delete (d.fighters[0] as { picked?: true }).picked;
  const cast = stepDuel(d as never, [{ ...idle(), action: 'skill' }, idle()]) as never as D;
  assert.ok((cast.fighters[0]!.special ?? 0) > 100, `a class cast is committed for the spell delay, got ${cast.fighters[0]!.special}`);
});

const landed = (skill: string) => {
  let d = duelOf(skill); const z0 = d.fighters[1]!.body.z, hp0 = d.fighters[1]!.health;
  d = stepDuel(d as never, [{ ...idle(), action: 'skill' }, idle()]) as never;
  for (let i = 0; i < 80 && !d.events.some((e) => e.type === 'SpecialLanded'); i++) d = stepDuel(d as never, [idle(), idle()]) as never;
  return { d, z0, hp0 };
};

test('when it lands the victim is staggered, shoved back, loses health and gains posture, from the move row', () => {
  const { d, z0, hp0 } = landed('cleave'), foe = d.fighters[1]!;
  assert.ok(d.events.some((e) => e.type === 'SpecialLanded'), 'the special landed');
  assert.equal(foe.phase, 'hurt');
  assert.ok(foe.stun > 0 && d.events.some((e) => e.type === 'Staggered'), 'a Staggered event');
  assert.ok(foe.body.z < z0, 'shoved away from the caster');
  assert.ok(foe.health < hp0, 'lost health');
  assert.ok(foe.posture > 0, 'gained posture');
});

test('specialReactFloor: the lunge (move row stagger 0) still staggers the victim by its floor row', () => {
  assert.ok(landed('lunge').d.fighters[1]!.stun >= 35, 'the floor row gives the lunge its stagger');
});
