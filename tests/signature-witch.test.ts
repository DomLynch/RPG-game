import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { CombatEvent } from '../src/duel.ts';
import { initialDuel } from '../src/duel.ts';
import { OPPONENTS } from '../src/moves.ts';
import { createSignatures, signatureMode } from '../src/signature.ts';
import { GRASP, graspLands } from '../src/signature-witch.ts';

const blow = (type: 'Hit' | 'GuardBroken', actor: 0 | 1, charged: boolean): CombatEvent => ({ tick: 7, type, actor, target: actor ? 0 : 1, move: 'heavy_overhead', location: 'torso', heading: 0, charged });

test('Witch Grasp: only her CHARGED blow that lands (a hit, or a guard it breaks) answers; an uncharged heavy or the player\'s charge does not', () => {
  assert.equal(graspLands(blow('Hit', 1, true)), true);
  assert.equal(graspLands(blow('GuardBroken', 1, true)), true);
  assert.equal(graspLands(blow('Hit', 1, false)), false);
  assert.equal(graspLands(blow('Hit', 0, true)), false);
  assert.equal(graspLands({ tick: 7, type: 'Blocked', actor: 0, target: 1, charged: true }), false);
});

test('Witch: the staff crackles while she is charged, the hand closes on the struck shoulder and is gone once it has crumbled', () => {
  const scene = new THREE.Scene(), signatures = createSignatures(scene, 'witch');
  signatures.setMode(signatureMode('on'));
  const rig = (bones: string[]) => { const root = new THREE.Object3D(); for (const name of bones) { const b = new THREE.Object3D(); b.name = name; b.position.y = 1.4; root.add(b); } scene.add(root); return root; };
  const player = rig(['upperarm_l', 'upperarm_r', 'spine_03']), witch = rig(['WeaponDrawn']);
  const duel = initialDuel(OPPONENTS.witch), fighters = duel.fighters;
  const frame = (charged: boolean) => ({ fighters: [fighters[0], { ...fighters[1], charged, phase: charged ? 'attack' as const : 'ready' as const }] as const, roots: [player, witch] as const, scale: [1, 1] as const, yielding: false });
  const shown = (kind: string) => scene.children.filter((o) => o.visible && o.type === kind).length;
  signatures.render(1 / 60, [], frame(false), null, [false, false]);
  assert.equal(shown('Points'), 0, 'no sparks before the charge');
  signatures.render(1 / 60, [{ tick: 3, type: 'Charged', actor: 1, move: 'heavy_overhead' }], frame(true), null, [false, false]);
  assert.equal(shown('Points'), 1, 'the staff crackles while charged');
  signatures.render(1 / 60, [blow('Hit', 1, true)], frame(false), null, [false, false]);
  const hand = scene.children.find((o) => o.visible && o.type === 'Mesh');
  assert.ok(hand, 'the hand closes over the wound');
  assert.ok(hand!.position.y > 1.4, 'on top of the shoulder, not in front of the chest');
  for (let t = 0; t < GRASP.close + GRASP.hold + GRASP.crumble + 0.1; t += 1 / 60) signatures.render(1 / 60, [], frame(false), null, [false, false]);
  assert.equal(hand!.visible, false, 'crumbled away');
  signatures.clear();
});
