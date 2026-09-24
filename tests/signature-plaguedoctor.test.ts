import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { SIGNATURES, pickSignature, createSignatureMarks, type SignatureFrame } from '../src/signature.ts';
import { ROT, rotSite } from '../src/signature-plaguedoctor.ts';

test('Rot Bloom is the Plague Doctor\'s A and answers only a blade blow he lands', () => {
  const effect = pickSignature(SIGNATURES.plaguedoctor, 'on');
  assert.equal(effect?.name, 'Rot Bloom');
  const fighters = [{}, {}] as never;
  const hit = (actor: 0 | 1, move: string): CombatEvent => ({ tick: 1, type: 'Hit', actor, target: actor ? 0 : 1, move: move as CombatEvent['move'], location: 'torso' });
  assert.equal(effect!.when(hit(1, 'heavy_overhead'), fighters), true);
  assert.equal(effect!.when(hit(0, 'heavy_overhead'), fighters), false);
  assert.equal(effect!.when(hit(1, 'kick'), fighters), false);
});

test('a torso blow blooms on the shoulder the fight camera sees, on the side the blow came from; head and legs keep the table', () => {
  assert.equal(rotSite(1, 'torso', 'right')?.bone, 'upperarm_l');
  assert.equal(rotSite(1, 'torso', 'left')?.bone, 'upperarm_r');
  assert.ok(rotSite(4, 'torso', 'overhead')!.dir[1] > 0.8, 'an overhead lands on the top of the shoulder');
  assert.ok(rotSite(4, 'torso', 'right')!.dir[2] < 0, 'turned toward his back, where the camera is');
  assert.equal(rotSite(1, 'head', 'right'), undefined);
});

test('the stain spreads, then settles into one capped body mark that stays; a finisher stands the spreading down', () => {
  const scene = new THREE.Scene(), root = new THREE.Group(), arm = new THREE.Bone(); arm.name = 'upperarm_l'; arm.position.y = 1.3; root.add(arm); scene.add(root);
  const marks = createSignatureMarks(scene);
  const fighters = [{ body: { x: 0, z: 4, heading: Math.PI }, weapon: 'longsword' }, { body: { x: 0, z: 2.5, heading: 0 }, weapon: 'longsword' }] as unknown as readonly [Fighter, Fighter];
  const frame = (yielding = false): SignatureFrame => ({ fighters, roots: [root, null], scale: [1, 1], yielding, marks });
  const effect = pickSignature(SIGNATURES.plaguedoctor, 'A')!;
  const blow: CombatEvent = { tick: 3, type: 'Hit', actor: 1, target: 0, move: 'light_right', location: 'torso' };
  effect.fire(blow, frame());
  effect.update!(ROT.grow / 2, frame());
  assert.equal(marks.count('body', 0), 0, 'still spreading: no persistent mark yet');
  effect.update!(ROT.grow, frame());
  assert.equal(marks.count('body', 0), 1, 'grown: it stays the fight');
  effect.fire({ ...blow, tick: 4 }, frame());
  effect.update!(0.1, frame(true));
  effect.update!(ROT.grow, frame());
  assert.equal(marks.count('body', 0), 1, 'a finisher cut the second one short');
});
