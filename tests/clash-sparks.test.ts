import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { blockDust, clashStrength, createClashSparks } from '../src/clash-sparks.ts';
import { WEAPONS } from '../src/moves.ts';
import type { CombatEvent } from '../src/duel.ts';

// Metal sparks (presentation): only a blade-on-blade block or parry throws them, and they behave like metal — thrown, falling, one bounce,
// out within 0.45 s — never covering a pose for long, never moving while paused.
const blocked = (extra: Partial<CombatEvent> = {}): CombatEvent => ({ tick: 1, type: 'Blocked', actor: 0, target: 1, move: 'light_right', weapon: 'trident', material: 'bronze', ...extra });

test('steel on steel only: blade guards spark against metal blades; shafts, wood, kicks and landed blows do not', () => {
  assert.ok(clashStrength(blocked(), WEAPONS.longsword) > 0, 'a bronze trident blocked by a longsword');
  assert.ok(clashStrength(blocked({ material: 'iron', weapon: 'cleaver' }), WEAPONS.estoc) > 0, 'an iron cleaver on a steel estoc');
  assert.equal(clashStrength(blocked(), WEAPONS.trident), 0, 'a shaft guard catches a blade without sparks');
  assert.equal(clashStrength(blocked(), WEAPONS.scythe), 0, 'the scythe guards with its shaft');
  assert.equal(clashStrength(blocked({ material: 'wood' }), WEAPONS.longsword), 0, 'a wooden weapon');
  assert.equal(clashStrength(blocked({ type: 'Hit' }), WEAPONS.longsword), 0, 'a landed blow is blood, not sparks');
  assert.equal(clashStrength({ tick: 1, type: 'Blocked', actor: 0, material: 'iron' }, WEAPONS.longsword), 0, 'no attacker, no contact point');
});

test('a parry sparks hardest, then a heavy, a perfect block, a plain block', () => {
  const parry = clashStrength(blocked({ type: 'Parried' }), WEAPONS.longsword), heavy = clashStrength(blocked({ move: 'heavy_overhead' }), WEAPONS.longsword);
  const perfect = clashStrength(blocked({ perfect: true }), WEAPONS.longsword), plain = clashStrength(blocked(), WEAPONS.longsword);
  assert.ok(parry > heavy && heavy > perfect && perfect > plain && plain > 0, `${parry} ${heavy} ${perfect} ${plain}`);
});

test('a burst throws 4–8 sparks and one glint over a frame or two that fall, bounce once off the sand, and die within 0.45 s; a pause holds them', () => {
  const scene = new THREE.Scene(), sparks = createClashSparks(scene), points = scene.getObjectByName('clash sparks') as THREE.Points;
  assert.ok(points && !points.visible);
  sparks.burst(new THREE.Vector3(0, 1.2, -1.3), new THREE.Vector3(0.3, 1.3, -1.5), Math.PI, 0.4); sparks.update(1 / 60); sparks.update(1 / 60); const few = sparks.alive();
  sparks.burst(new THREE.Vector3(0, 1.2, -1.3), new THREE.Vector3(0.3, 1.3, -1.5), Math.PI, 0.9); sparks.update(1 / 60); sparks.update(1 / 60); const many = sparks.alive();
  assert.ok(few >= 4 && few <= 9 && many >= few + 3 && many <= 18, `${few} then ${many}`);
  sparks.update(1 / 60); assert.ok(points.visible);
  const position = points.geometry.attributes.position as THREE.BufferAttribute, before = position.getY(0);
  sparks.update(0); assert.equal(position.getY(0), before, 'dt 0 moved a spark');
  let minY = Infinity, maxY = -Infinity, frames = 0;
  for (; sparks.alive() > 0 && frames < 60; frames++) { sparks.update(1 / 60); for (let i = 0; i < position.count; i++) if ((points.geometry.attributes.sparkSize as THREE.BufferAttribute).getX(i) > 0) { minY = Math.min(minY, position.getY(i)); maxY = Math.max(maxY, position.getY(i)); } }
  assert.ok(minY >= 0.01 - 1e-6, `a spark went under the sand: ${minY}`); assert.ok(maxY > 1.2, 'no spark rose from the contact');
  assert.ok(frames <= 0.45 * 60 + 1, `sparks lived ${frames} frames`); assert.ok(!points.visible, 'points stay visible after the last spark died');
  sparks.dispose(); assert.equal(scene.getObjectByName('clash sparks'), undefined);
});

// Block feedback, pick C (SCOPE 7): the ground answers every block, harder the worse it was held, and a broken guard drives both feet.
test('block dust: every block puffs off the rear foot by how hard it was held; a broken guard off both feet; parries and light hits move no sand', () => {
  assert.deepEqual(blockDust(blocked({ perfect: true })), { feet: 'rear', strength: .25 });
  assert.deepEqual(blockDust(blocked()), { feet: 'rear', strength: .4 });
  assert.deepEqual(blockDust(blocked({ move: 'kick' })), { feet: 'rear', strength: .4 }, 'a braced kick');
  assert.deepEqual(blockDust(blocked({ move: 'heavy_overhead' })), { feet: 'rear', strength: .6 });
  assert.deepEqual(blockDust(blocked({ type: 'GuardBroken', move: 'thrust' })), { feet: 'both', strength: 1 });
  assert.deepEqual(blockDust(blocked({ type: 'Hit', move: 'heavy_counter' })), { feet: 'rear', strength: 1 }, 'a heavy on a planted man, as before');
  assert.equal(blockDust(blocked({ type: 'Hit' })), null, 'a light that lands');
  assert.equal(blockDust(blocked({ type: 'Parried' })), null);
  assert.equal(blockDust({ tick: 1, type: 'Blocked', actor: 0 }), null, 'no attacker');
});
