// sandbox specialLook rows: a melee special that lands throws the shared skill-impact kit, shaped by its row; with no row (trunk) nothing changes, and a spell landing never throws it.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const rows = (DEFS as unknown as { specialLook: object[] }).specialLook;
const { impactOf } = await import('../src/fight/skill-impact.ts');
const landed = (move: string, extra: object = {}) => ({ tick: 1, type: 'SpecialLanded', actor: 0, target: 1, move, damage: 10, ...extra }) as never;

test('with no specialLook row a landed special throws nothing (trunk is unchanged)', () => {
  assert.equal(impactOf(landed('skill_stomp')), null);
});

test('a row makes the landing throw the kit, shaped by the row, in the skill\'s own tint', () => {
  rows.push({ id: 'stomp', flash: 150, sparks: 300, spread: 200, lift: 20 }, { id: 'pommel', flash: 70, sparks: 60, spread: 50, lift: 60 });
  const stomp = impactOf(landed('skill_stomp')), pommel = impactOf(landed('skill_pommel'));
  assert.ok(stomp && pommel);
  assert.equal(stomp.look?.sparks, 300); assert.equal(pommel.look?.sparks, 60);
  assert.notEqual(stomp.tint, pommel.tint, 'each skill keeps its own colour');
  assert.equal(impactOf(landed('skill_stomp', { spell: 'gula' })), null, 'a spell landing is not a melee special');
  assert.equal(impactOf(landed('skill_stomp', { target: 0 })), null, 'a heal on yourself is not an impact');
  assert.equal(impactOf({ ...landed('skill_witchfire') } as never), null, 'witch-fire keeps its own look');
  rows.length = 0;
});
