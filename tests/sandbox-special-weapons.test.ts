// sandbox: every melee weapon can cast every one of the four beta specials (Skull Crack, Whirlwind, Ground Slam, Lunge): the cast lands and the victim is hurt and staggered. (Staff, bow and crossbow are stand-ins that fire missiles; they are not melee weapons.)
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };
import { offDefs } from './lib/sandbox-defs-off.ts';
offDefs(DEFS);   // the sandbox tests patch from the OFF baseline; the shipped rows are ON (tests/lib/sandbox-defs-off.ts)

const rule = (id: string) => (DEFS as unknown as { rules: { id: string; value: number }[] }).rules.find((r) => r.id === id)!;
rule('specialMeleeWindup').value = 32; rule('specialReact').value = 1;
(DEFS as unknown as { specialReactFloor: object[] }).specialReactFloor.push({ id: 'lunge', stagger: 36 });
const { createFighter, stepDuel, idleIntent } = await import('../src/fight/duel.ts');
const idle = () => ({ ...idleIntent(), lock: false });
const MELEE = ['longsword', 'trident', 'cleaver', 'estoc', 'knife', 'gladius', 'scythe', 'maul', 'warhammer'];
const SPECIALS = ['cleave', 'reaping', 'stomp', 'lunge'];

for (const weapon of MELEE) for (const skill of SPECIALS) test(`${skill} lands and staggers with the ${weapon}`, () => {
  let d = { tick: 0, fighters: [{ ...createFighter({ x: 0, z: 1.2, heading: Math.PI, distance: 0 }, 'ready', weapon as never), specialShare: 0.1, skillCooldown: 0, skill: skill as never, picked: true as const }, createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready')], finish: null } as never as { fighters: { health: number; stun: number; phase: string }[]; events: { type: string }[] };
  const hp0 = d.fighters[1]!.health;
  d = stepDuel(d as never, [{ ...idle(), action: 'skill' }, idle()]) as never;
  for (let i = 0; i < 90 && !d.events.some((e) => e.type === 'SpecialLanded'); i++) d = stepDuel(d as never, [idle(), idle()]) as never;
  assert.ok(d.events.some((e) => e.type === 'SpecialLanded'), 'the special landed');
  assert.ok(d.fighters[1]!.health < hp0, 'the victim lost health');
  assert.ok(d.fighters[1]!.stun > 0 && d.fighters[1]!.phase === 'hurt', 'the victim is staggered');
});
