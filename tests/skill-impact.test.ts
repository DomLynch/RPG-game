import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Color, Scene } from 'three';
import type { CombatEvent } from '../src/duel.ts';
import { IMPACT, IMPACT_DEFAULT, IMPACT_TINT, createSkillImpact, impactOf, impactPoint } from '../src/skill-impact.ts';

// The shared SKILL-IMPACT kit (Strategy via Lead, 2026-09-26): every skill move ships on it, keyed by its SkillId (move id = skill_<id>).
const hit = (move: string, extra: Partial<CombatEvent> = {}): CombatEvent => ({ tick: 10, type: 'Hit', actor: 0, target: 1, move, location: 'torso', ...extra } as CombatEvent);
const fighters = [{ body: { x: 0, z: 4 } }, { body: { x: 0, z: 2 } }] as never;

test('only a landed skill blow fires the kit: not Witch-fire (its own fire), not a plain blow, not a block or a parry', () => {
  assert.deepEqual(impactOf(hit('skill_pommel')), { id: 'pommel', tint: IMPACT_TINT.pommel, strength: 1 });
  assert.equal(impactOf(hit('skill_pommel', { guarded: true }))?.strength, 0.5, 'through a raised guard, half');
  assert.equal(impactOf(hit('skill_witchfire')), null);
  for (const move of ['light', 'heavy_overhead', 'kick']) assert.equal(impactOf(hit(move)), null, move);
  for (const type of ['Blocked', 'Parried', 'Dodged', 'AttackMissed'] as const) assert.equal(impactOf(hit('skill_pommel', { type })), null, type);
  assert.equal(impactOf(hit('skill_pommel', { target: undefined })), null);
});

test('the nine SCOPE 8 moves and Pommel each have their own tint; a skill not in the table yet flashes the neutral default', () => {
  const ids = ['pommel', 'lunge', 'reaping', 'shove', 'jab', 'cleave', 'stomp', 'miasma', 'ironrush', 'hewer'];
  assert.deepEqual(Object.keys(IMPACT_TINT).sort(), [...ids].sort(), 'the SkillIds Lead fixed, and nothing else');
  assert.equal(new Set(Object.values(IMPACT_TINT)).size, ids.length, 'no two moves share a colour');
  assert.equal(impactOf(hit('skill_newmove'))?.tint, IMPACT_DEFAULT);
  const hsl = (hex: string) => new Color(hex).getHSL({ h: 0, s: 0, l: 0 });
  for (const [id, hex] of Object.entries(IMPACT_TINT)) {
    const { h, s } = hsl(hex), hue = h * 360;
    assert.ok(s < 0.25 || hue < 75 || hue > 165, `${id} ${hex} (hue ${hue.toFixed(0)}): green is Witch-fire's, and the warden's cue`);
  }
  assert.ok(hsl(IMPACT_TINT.pommel!).s < 0.25, 'Pommel is neutral steel (Lead): no hue to compete with anything');
});

test('it lands on the struck body at the hit location\'s height, on the side facing the attacker, scaled with the man', () => {
  const torso = impactPoint(hit('skill_pommel'), fighters, [1, 1]);
  assert.deepEqual([torso.x, +torso.y.toFixed(2), +torso.z.toFixed(2)], [0, 1.2, +(2 + IMPACT.reach).toFixed(2)]);
  const head = impactPoint(hit('skill_pommel', { location: 'head' }), fighters, [1, 1.2]), legs = impactPoint(hit('skill_pommel', { location: 'legs' }), fighters, [1, 1]);
  assert.ok(head.y > torso.y && legs.y < torso.y, 'head above torso above legs');
  assert.ok(Math.abs(head.y - 1.62 * 1.2) < 1e-9, 'a bigger man is struck higher');
});

test('a landed blow throws a flash and a fan of sparks, which burn out within the kit\'s life; a pause holds them', () => {
  const kit = createSkillImpact(new Scene());
  assert.equal(kit.fire([hit('light'), hit('skill_witchfire')], fighters, [1, 1]), 0);
  assert.equal(kit.alive(), 0, 'nothing for a plain blow or Witch-fire');
  assert.equal(kit.fire([hit('skill_pommel')], fighters, [1, 1]), 1);
  assert.equal(kit.alive(), 1 + IMPACT.sparks, 'one flash and the full fan');
  assert.deepEqual(kit.last().map(v => +v.toFixed(2)), [0, 1.2, +(2 + IMPACT.reach).toFixed(2)]);
  kit.update(0); assert.equal(kit.alive(), 1 + IMPACT.sparks, 'dt 0 (a pause) ages nothing');
  kit.update(0.1); kit.update(IMPACT.flash - 0.09);   // update clamps a frame to 0.1 s, as the clash sparks do
  assert.equal(kit.alive(), IMPACT.sparks, 'the flash is gone first; every spark still flies (each lives ≥ half the kit\'s life)');
  for (let k = 0; k < 10; k++) kit.update(0.05);
  assert.equal(kit.alive(), 0, 'all out within the kit\'s life');
  assert.equal(kit.fire([hit('skill_pommel', { guarded: true })], fighters, [1, 1]), 1);
  assert.equal(kit.alive(), 1 + Math.round(IMPACT.sparks * 0.75), 'a guarded blow throws fewer');
  kit.dispose();
});

test('presentation only: the kit is no sim file and no sim file imports it', () => {
  const guard = readFileSync(new URL('./record-version-guard.test.ts', import.meta.url), 'utf8');
  assert.ok(!guard.includes('skill-impact'), 'not in SIM_FILES');
  for (const file of ['duel.ts', 'moves.ts', 'ai.ts', 'sim.ts', 'record.ts', 'blade.ts', 'roster.ts', 'finishers.ts']) {
    assert.ok(!readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8').includes('skill-impact'), `${file} does not import it`);
  }
});
