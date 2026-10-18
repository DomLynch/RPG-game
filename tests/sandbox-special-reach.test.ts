// sandbox specialMeleeReach / specialMeleeSlack, switched ON for this process only (the rows ship 0 = trunk): a MELEE special (no spell) is pressed only inside the reach (a "far" refusal, nothing spent) and lands at the release only
// inside reach + slack (a foe that steps out of it during the windup is not hit). Donor: the combat sandbox (sandbox/page @3b118938e, Dom 2026-10-18: a special landed from across the arena).
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const rule = (id: string) => (DEFS as unknown as { rules: { id: string; value: number }[] }).rules.find((r) => r.id === id)!;
rule('specialMeleeWindup').value = 32; rule('specialMeleeReach').value = 220; rule('specialMeleeSlack').value = 40;
const { createFighter, stepDuel, idleIntent } = await import('../src/fight/duel.ts');
const { specialCueText } = await import('../src/fight/sandbox-rules.ts');
const idle = () => ({ ...idleIntent(), lock: false });
type D = { fighters: { special?: number; skillCooldown?: number; health: number; body: { z: number } }[]; events: { type: string; cue?: string; actor?: number }[] };
const duelAt = (gap: number) => ({ tick: 0, fighters: [{ ...createFighter({ x: 0, z: gap, heading: Math.PI, distance: 0 }, 'ready'), specialShare: 0.1, skillCooldown: 0, skill: 'cleave' as never, picked: true as const }, createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready')] });

test('a press beyond the reach is refused with the far cue and spends nothing', () => {
  const d = stepDuel(duelAt(2.3) as never, [{ ...idle(), action: 'skill' }, idle()]) as never as D;
  assert.ok(d.events.some((e) => e.type === 'SpecialRefused' && e.cue === 'far' && e.actor === 0), 'a SpecialRefused far event for the caster');
  assert.ok(!(d.fighters[0]!.special ?? 0), 'no windup started');
  assert.ok(!d.fighters[0]!.skillCooldown, 'the cooldown is not spent');
  assert.equal(specialCueText('far'), 'too far');
});

test('a press inside the reach starts the special', () => {
  const d = stepDuel(duelAt(2.0) as never, [{ ...idle(), action: 'skill' }, idle()]) as never as D;
  assert.ok((d.fighters[0]!.special ?? 0) > 0, 'the windup started');
  assert.ok(!d.events.some((e) => e.type === 'SpecialRefused'), 'no refusal');
});

test('a foe that steps beyond reach + slack during the windup is not hit: the release fizzles', () => {
  let d = stepDuel(duelAt(2.0) as never, [{ ...idle(), action: 'skill' }, idle()]) as never as D;
  const hp0 = d.fighters[1]!.health;
  (d.fighters[1]! as { body: { z: number } }).body = { ...(d.fighters[1]! as unknown as { body: object }).body, z: -2 } as never;   // 4.0 m away now
  for (let i = 0; i < 80 && !d.events.some((e) => e.type === 'SpecialFizzled' || e.type === 'SpecialLanded'); i++) d = stepDuel(d as never, [idle(), idle()]) as never;
  assert.ok(d.events.some((e) => e.type === 'SpecialFizzled'), 'the release fizzled');
  assert.ok(!d.events.some((e) => e.type === 'SpecialLanded'), 'nothing landed');
  assert.equal(d.fighters[1]!.health, hp0);
});

test('a foe just inside reach + slack at the release is still hit', () => {
  let d = stepDuel(duelAt(2.0) as never, [{ ...idle(), action: 'skill' }, idle()]) as never as D;
  (d.fighters[1]! as { body: { z: number } }).body = { ...(d.fighters[1]! as unknown as { body: object }).body, z: -0.5 } as never;   // 2.5 m: past the 2.2 m press reach, inside 2.6 m
  for (let i = 0; i < 80 && !d.events.some((e) => e.type === 'SpecialFizzled' || e.type === 'SpecialLanded'); i++) d = stepDuel(d as never, [idle(), idle()]) as never;
  assert.ok(d.events.some((e) => e.type === 'SpecialLanded'), 'the slack lets it land');
});
