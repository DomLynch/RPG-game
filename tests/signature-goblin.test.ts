import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SIGNATURES, pickSignature } from '../src/signature.ts';
import { HOOK, strandPoints } from '../src/signature-goblin.ts';
import type { CombatEvent } from '../src/duel.ts';

test('Hooked Wound is the Goblin\'s A and answers only a blade blow he lands', () => {
  const effect = pickSignature(SIGNATURES.goblin, 'on');
  assert.equal(effect?.name, 'Hooked Wound');
  const fighters = [{}, {}] as never;
  const hit = (actor: 0 | 1, move: string): CombatEvent => ({ tick: 1, type: 'Hit', actor, target: actor ? 0 : 1, move: move as CombatEvent['move'], location: 'torso' });
  assert.equal(effect!.when(hit(1, 'light_right'), fighters), true);
  assert.equal(effect!.when(hit(0, 'light_right'), fighters), false);
  assert.equal(effect!.when(hit(1, 'kick'), fighters), false);
});

test('variant B (depth-tested strand) sits beside the A; On still means the A', () => {
  assert.equal(pickSignature(SIGNATURES.goblin, 'B')?.name, 'Hooked Wound (hidden when his hand is)');
  assert.equal(pickSignature(SIGNATURES.goblin, 'on')?.variant, 'A');
});

test('variant C (heavy strand, flung drops) sits beside A and B', () => {
  assert.equal(pickSignature(SIGNATURES.goblin, 'C')?.name, 'Hooked Wound (heavy strand, flung drops)');
});

test('the strand runs wound to knife with a sag, and after the snap each half pulls back into its own end', () => {
  const a = new THREE.Vector3(0, 1.2, 0), b = new THREE.Vector3(0.6, 1.2, 0);
  const out = Array.from({ length: HOOK.points }, () => new THREE.Vector3());
  strandPoints(out, a, b, 0, 0);
  assert.ok(out[0].distanceTo(a) < 1e-9 && out[HOOK.points - 1].distanceTo(b) < 1e-9);
  assert.ok(out[Math.floor(HOOK.points / 2)].y < 1.2 - HOOK.sag * 0.9, 'it hangs in the middle');
  strandPoints(out, a, b, 1, 1);
  for (const [i, p] of out.entries()) assert.ok(p.distanceTo(i < HOOK.points / 2 ? a : b) < 1e-9, 'snapped: every point is back on its end');
});
