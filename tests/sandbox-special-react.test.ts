// sandbox specialMeleeWindup + specialReact: a MELEE special (no spell) is committed for the row's ticks (a heavy swing's pace, not the spell's 2 s) and, when it lands, staggers, shoves and shakes the victim by its move row like a landed blow.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const rule = (id: string) => (DEFS as unknown as { rules: { id: string; value: number }[] }).rules.find((r) => r.id === id)!;
rule('specialMeleeWindup').value = 32; rule('specialReact').value = 1;
const { createFighter, stepDuel, idleIntent } = await import('../src/fight/duel.ts');
const idle = () => ({ ...idleIntent(), lock: false });
const duelOf = () => ({ tick: 0, fighters: [{ ...createFighter({ x: 0, z: 1.2, heading: Math.PI, distance: 0 }, 'ready'), specialShare: 0.1, skillCooldown: 0, skill: 'cleave' as never }, createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] }) as never as { fighters: { special?: number; phase: string; stun: number; body: { z: number }; health: number; maxHealth: number; posture: number }[]; events: { type: string; ticks?: number }[] };

test('a melee special is committed for the row\'s windup, not the spell windup', () => {
  let d = stepDuel(duelOf() as never, [{ ...idle(), action: 'skill' }, idle()]) as never as ReturnType<typeof duelOf>;
  assert.ok((d.fighters[0]!.special ?? 0) > 0 && (d.fighters[0]!.special ?? 0) <= 33, `committed for ${d.fighters[0]!.special} ticks`);
});

test('when it lands the victim is staggered, shoved back and loses health and gains posture, from the move row', () => {
  let d = duelOf(); const z0 = d.fighters[1]!.body.z, hp0 = d.fighters[1]!.health;
  d = stepDuel(d as never, [{ ...idle(), action: 'skill' }, idle()]) as never;
  for (let i = 0; i < 60 && !d.events.some((e) => e.type === 'SpecialLanded'); i++) d = stepDuel(d as never, [idle(), idle()]) as never;
  const foe = d.fighters[1]!;
  assert.ok(d.events.some((e) => e.type === 'SpecialLanded'), 'the special landed');
  assert.equal(foe.phase, 'hurt');
  assert.ok(foe.stun > 0 && d.events.some((e) => e.type === 'Staggered'), 'a Staggered event');
  assert.ok(foe.body.z < z0, 'shoved away from the caster');
  assert.ok(foe.health < hp0, 'lost health');
  assert.ok(foe.posture > 0, 'gained posture');
});
