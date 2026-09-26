import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { SIGNATURES } from '../src/signature.ts';
import { rivetBurstA } from '../src/signature-knight.ts';

const fighters = [{}, {}] as unknown as readonly [Fighter, Fighter];
const hit = (target: 0 | 1, move: string, damage: number): CombatEvent => ({ tick: 1, type: 'Hit', actor: target ? 0 : 1, target, move: move as CombatEvent['move'], damage, location: 'torso', heading: 0 });

test('the Rivet Burst answers a substantial blow landed on the Knight, and nothing lighter, his own blows or a miss', () => {
  const burst = SIGNATURES.knight?.find((e) => e.variant === 'A');
  assert.equal(burst?.name, 'Rivet Burst');
  const when = (e: CombatEvent) => burst!.when(e, fighters);
  assert.equal(when(hit(1, 'heavy_overhead', 18)), true, 'a heavy on him');
  assert.equal(when(hit(1, 'light_right', 16)), true, 'a cut past the light cut 14');
  assert.equal(when(hit(1, 'light_right', 14)), false, 'a light cut');
  assert.equal(when(hit(1, 'thrust', 11)), false, 'a light stab');
  assert.equal(when(hit(1, 'kick', 30)), false, 'a kick is not a blade');
  assert.equal(when(hit(0, 'heavy_overhead', 18)), false, 'his own heavy on the player');
  assert.equal(when({ tick: 1, type: 'AttackMissed', actor: 0, move: 'heavy_overhead' }), false, 'a miss');
  assert.equal(when({ tick: 1, type: 'Blocked', actor: 1, target: 0, move: 'heavy_overhead' }), false, 'a blocked heavy');
});

test('A (the lit dent) is the Knight\'s shipped signature: On resolves to it; B stays registered for the preview, on the same trigger', async () => {
  const { pickSignature } = await import('../src/signature.ts');
  assert.deepEqual(SIGNATURES.knight?.map((e) => e.variant), ['A', 'B']);
  assert.equal(pickSignature(SIGNATURES.knight, 'on'), rivetBurstA);
  assert.equal(pickSignature(SIGNATURES.knight, 'B')?.name, 'Rivet Burst (dark dent)');
  const b = SIGNATURES.knight!.find((e) => e.variant === 'B')!;
  assert.equal(b.when(hit(1, 'heavy_overhead', 18), fighters), true);
  assert.equal(b.when(hit(1, 'light_right', 14), fighters), false);
});
