import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { CombatEvent } from '../src/duel.ts';
import { initialDuel } from '../src/duel.ts';
import { OPPONENTS } from '../src/moves.ts';
import { createSignatures, signatureMode } from '../src/signature.ts';
import { GRASP, SPARK, graspLands } from '../src/signature-witch.ts';

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
  const streaks = () => scene.children.find((o) => o.renderOrder === 5) as THREE.Mesh;   // the spark pool (the ash pool is built after it)
  signatures.render(1 / 60, [], frame(false), null, [false, false]);
  assert.equal(streaks().visible, false, 'no sparks before the charge');
  signatures.render(1 / 60, [{ tick: 3, type: 'Charged', actor: 1, move: 'heavy_overhead' }], frame(true), null, [false, false]);
  assert.equal(streaks().visible, true, 'the staff crackles while charged');
  // Every live spark stays near the staff head: speed x life bounds how far one can fly (Strategy: no square loose in the scene).
  for (let t = 0; t < 0.5; t += 1 / 60) signatures.render(1 / 60, [], frame(true), null, [false, false]);
  const tip = witch.getObjectByName('WeaponDrawn')!.localToWorld(new THREE.Vector3(0, 0.86, 0)), pos = streaks().geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) assert.ok(new THREE.Vector3().fromBufferAttribute(pos, i).distanceTo(tip) < SPARK.speedMax * SPARK.lifeMax + 0.12, `spark vertex ${i} strayed`);
  for (let t = 0; t < SPARK.lifeMax + 0.02; t += 1 / 60) signatures.render(1 / 60, [], frame(false), null, [false, false]);
  assert.equal(streaks().visible, false, 'the charge is over: every spark is spent');
  signatures.render(1 / 60, [blow('Hit', 1, true)], frame(false), null, [false, false]);
  const hand = scene.children.find((o) => o.visible && o.renderOrder === 4) as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  assert.ok(hand, 'the hand closes over the wound');
  assert.ok(hand!.position.y > 1.4, 'on top of the shoulder, not in front of the chest');
  assert.equal(hand.material.transparent, false, 'a solid claw, not a see-through stencil');
  for (let t = 0; t < GRASP.close + GRASP.hold + GRASP.crumble * 0.6; t += 1 / 60) signatures.render(1 / 60, [], frame(false), null, [false, false]);
  assert.ok(hand.material.alphaTest > 0.5, 'past half the crumble most of the hand is gone');
  assert.ok((scene.children.find((o) => o.renderOrder === 5 && o !== streaks()) as THREE.Mesh).visible, 'ash is falling off it');
  for (let t = 0; t < GRASP.crumble * 0.4 + 0.1; t += 1 / 60) signatures.render(1 / 60, [], frame(false), null, [false, false]);
  assert.equal(hand!.visible, false, 'crumbled away');
  signatures.clear();
});
