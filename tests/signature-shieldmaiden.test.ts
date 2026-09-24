import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { SIGNATURES, SIGNATURE_CAPS, createSignatureMarks } from '../src/signature.ts';
import { SPLINTER, signatureState } from '../src/signature-shieldmaiden.ts';

const blocked = (actor: 0 | 1, move: string): CombatEvent => ({ tick: 1, type: 'Blocked', actor, target: actor ? 0 : 1, move: move as CombatEvent['move'] });
const fighters = [{}, {}] as unknown as readonly [Fighter, Fighter];
const effect = () => SIGNATURES.shieldmaiden!.find((e) => e.variant === 'A')!;

function rig(withShield: boolean) {
  const scene = new THREE.Scene(), marks = createSignatureMarks(scene);
  const her = new THREE.Group(), player = new THREE.Group(), hand = new THREE.Bone();
  hand.name = 'hand_r'; hand.position.set(0.2, 1.1, 0.3); her.add(hand); player.position.set(0, 0, 3);
  if (withShield) { const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05)); shield.userData.slot = 'Shield'; shield.position.set(-0.3, 1.1, 0.3); her.add(shield); }
  scene.add(her, player);
  return { marks, frame: { fighters, roots: [player, her] as const, scale: [1, 1] as const, yielding: false, marks } };
}

test('Splintered Defiance answers only a heavy the Shieldmaiden blocks', () => {
  assert.equal(effect().name, 'Splintered Defiance');
  assert.equal(effect().when(blocked(1, 'heavy_overhead'), fighters), true);
  assert.equal(effect().when(blocked(1, 'light_right'), fighters), false, 'a blocked light is not her signature');
  assert.equal(effect().when(blocked(0, 'heavy_overhead'), fighters), false, "the player's block is not hers");
});

test('with no shield on her the splinters still fly from her guard, and no shield mark is made', () => {
  const { marks, frame } = rig(false);
  effect().fire(blocked(1, 'heavy_overhead'), frame);
  assert.equal(signatureState().splinters, SPLINTER.pieces);
  assert.equal(marks.count('shield'), 0);
  for (let t = 0; t < SPLINTER.seconds + 0.1; t += 1 / 60) effect().update!(1 / 60, frame);
  assert.equal(signatureState().splinters, 0, 'the splinters are gone after their life');
});

test('with a shield each blocked heavy chips its rim, and the chips stay up to the shield cap', () => {
  const { marks, frame } = rig(true);
  for (let i = 0; i < SIGNATURE_CAPS.shield + 2; i++) effect().fire(blocked(1, 'heavy_overhead'), frame);
  assert.equal(marks.count('shield'), SIGNATURE_CAPS.shield, 'battered, but capped');
  effect().update!(1 / 60, { ...frame, yielding: true });
  assert.equal(signatureState().splinters, 0, 'a finisher stands the splinters down');
  assert.equal(marks.count('shield'), SIGNATURE_CAPS.shield, 'the chips stay');
});
