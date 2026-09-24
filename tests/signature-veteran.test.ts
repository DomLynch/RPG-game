import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { pickSignature, SIGNATURES } from '../src/signature.ts';
import { battleScars } from '../src/signature-veteran.ts';

const fighters = [{}, {}] as unknown as readonly [Fighter, Fighter];
const hit = (target: 0 | 1, move: string, damage: number): CombatEvent => ({ tick: 1, type: 'Hit', actor: target ? 0 : 1, target, move: move as CombatEvent['move'], damage, location: 'torso', heading: 0 });

test('the Veteran registers only Blade Bite (B), so "On" resolves to it; A is kept unregistered', () => {
  assert.deepEqual(SIGNATURES.veteran?.map((e) => `${e.variant}:${e.name}`), ['B:Blade Bite']);
  assert.equal(pickSignature(SIGNATURES.veteran, 'on')?.name, 'Blade Bite');
  assert.equal(pickSignature(SIGNATURES.veteran, 'B')?.name, 'Blade Bite');
  assert.equal(pickSignature(SIGNATURES.veteran, 'A'), null);
});

test('Blade Bite answers his parry only: not the player\'s parry, his block, or a blow either way', () => {
  const when = (e: CombatEvent) => SIGNATURES.veteran![0].when(e, fighters);
  assert.equal(when({ tick: 1, type: 'Parried', actor: 1, target: 0, move: 'light_right' }), true, 'he parried');
  assert.equal(when({ tick: 1, type: 'Parried', actor: 0, target: 1, move: 'light_right' }), false, 'the player parried him');
  assert.equal(when({ tick: 1, type: 'Blocked', actor: 1, target: 0, move: 'light_right' }), false, 'he blocked');
  assert.equal(when(hit(1, 'heavy_overhead', 18)), false, 'a heavy on him');
  assert.equal(when(hit(0, 'heavy_overhead', 18)), false, 'his heavy on the player');
});

test('the kept Battle Scars trigger still reads a substantial blow on him and nothing lighter', () => {
  const when = (e: CombatEvent) => battleScars.when(e, fighters);
  assert.equal(when(hit(1, 'heavy_overhead', 18)), true);
  assert.equal(when(hit(1, 'light_right', 14)), false);
  assert.equal(when(hit(1, 'kick', 30)), false);
  assert.equal(when(hit(0, 'heavy_overhead', 18)), false);
});
