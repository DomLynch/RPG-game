import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shoveFor } from '../src/camera-kick.ts';
import type { CombatEvent } from '../src/duel.ts';

// The camera shove table (presentation): every contact stays within a few centimetres and settles within a quarter second; a heavy lands
// hardest and holds two frames; a parry alone flicks sideways; nothing else moves the camera.
const event = (type: CombatEvent['type'], extra: Partial<CombatEvent> = {}): CombatEvent => ({ tick: 1, type, actor: 0, target: 1, move: 'light_right', ...extra });

test('a heavy lands hardest and holds; a light is a nudge; blocks rock less than blows; a parry flicks sideways', () => {
  const heavy = shoveFor(event('Hit', { move: 'heavy_overhead' }))!, charged = shoveFor(event('Hit', { charged: true }))!, light = shoveFor(event('Hit'))!;
  const heavyBlock = shoveFor(event('Blocked', { move: 'heavy_overhead' }))!, block = shoveFor(event('Blocked'))!, perfect = shoveFor(event('Blocked', { perfect: true }))!, parry = shoveFor(event('Parried'))!;
  assert.deepEqual(heavy, charged); assert.ok(heavy.drop > heavyBlock.drop && heavyBlock.drop > block.drop && light.drop < heavyBlock.drop, 'ordering');
  assert.ok(heavy.hold === 2 / 60 && light.hold === 0 && heavyBlock.hold === 1 / 60, 'holds');
  assert.ok(perfect.drop > block.drop, 'a perfect block rocks a little more than a plain one');
  assert.ok(parry.side !== 0 && [heavy, light, block, heavyBlock].every(s => s.side === 0), 'only a parry flicks sideways');
  assert.equal(shoveFor(event('Parried', { move: 'light_left' }))!.side, -parry.side, 'the flick follows the deflection');
});

test('every shove is small and brief; other events move nothing', () => {
  for (const type of ['Hit', 'GuardBroken', 'Blocked', 'Parried'] as const) for (const move of ['light_right', 'heavy_overhead'] as const) {
    const s = shoveFor(event(type, { move }))!;
    assert.ok(s && Math.hypot(s.along, s.drop, s.side) <= 0.08 && s.settle <= 0.25 && s.hold <= 2 / 60, `${type} ${move}: ${JSON.stringify(s)}`);
  }
  for (const type of ['AttackStarted', 'Killed', 'Dodged', 'Staggered', 'StaminaExhausted'] as const) assert.equal(shoveFor(event(type)), null, type);
});
