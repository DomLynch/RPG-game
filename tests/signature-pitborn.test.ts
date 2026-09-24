import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { SIGNATURES, createSignatureMarks } from '../src/signature.ts';
import { WAKE, wakeState } from '../src/signature-pitborn.ts';

const hit = (actor: 0 | 1, move: string): CombatEvent => ({ tick: 1, type: 'Hit', actor, target: actor ? 0 : 1, move: move as CombatEvent['move'], location: 'torso', direction: 'right', heading: Math.PI });
const fighters = [{}, {}] as unknown as readonly [Fighter, Fighter];

test("Butcher's Wake answers only the Pitborn's landed heavy", () => {
  const wake = SIGNATURES.pitborn?.find((e) => e.variant === 'A');
  assert.equal(wake?.name, "Butcher's Wake");
  assert.equal(wake!.when(hit(1, 'heavy_overhead'), fighters), true);
  assert.equal(wake!.when(hit(1, 'light_right'), fighters), false, 'a light hit is not his wake');
  assert.equal(wake!.when(hit(0, 'heavy_overhead'), fighters), false, "the player's heavy is not his wake");
});

test('the sheet grows, tears into drops, and the drops land as at most two floor spots per wake', () => {
  const wake = SIGNATURES.pitborn!.find((e) => e.variant === 'A')!;
  const scene = new THREE.Scene(), marks = createSignatureMarks(scene);
  const root = new THREE.Group(), bone = new THREE.Bone();
  bone.name = 'spine_02'; bone.position.set(0, 1.25, 0); root.add(bone); scene.add(root);
  const frame = { fighters, roots: [root, null] as const, scale: [1, 1.13] as const, yielding: false, bloodMode: 'red' as const, marks };
  wake.fire(hit(1, 'heavy_overhead'), frame);
  assert.deepEqual(wakeState(), { sheets: 1, drops: 0 });
  for (let t = 0; t < WAKE.tear + 0.02; t += 1 / 60) wake.update!(1 / 60, frame);
  assert.equal(wakeState().sheets, 0, 'the sheet has torn');
  assert.equal(wakeState().drops, WAKE.drops, 'into heavy drops');
  for (let t = 0; t < 2; t += 1 / 60) wake.update!(1 / 60, frame);
  assert.equal(wakeState().drops, 0, 'every drop has landed');
  assert.equal(marks.count('floor'), WAKE.spots);
  wake.fire(hit(1, 'heavy_overhead'), { ...frame, yielding: false });
  wake.update!(1 / 60, { ...frame, yielding: true });
  assert.deepEqual(wakeState(), { sheets: 0, drops: 0 }, 'a finisher stands the wake down');
});

test("Butcher's Wake is blood: it stands down while the player has blood off", () => {
  assert.equal(SIGNATURES.pitborn!.find((e) => e.variant === 'A')!.blood, true);
});
