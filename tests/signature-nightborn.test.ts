import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SIGNATURES, pickSignature } from '../src/signature.ts';
import { RECALL, recallPosition, recallTime } from '../src/signature-nightborn.ts';
import type { CombatEvent } from '../src/duel.ts';

test('Blood Recall is the Nightborn\'s A and answers only a blade blow he lands', () => {
  const effect = pickSignature(SIGNATURES.nightborn, 'on');
  assert.equal(effect?.name, 'Blood Recall');
  const fighters = [{}, {}] as never;
  const hit = (actor: 0 | 1, move: string): CombatEvent => ({ tick: 1, type: 'Hit', actor, target: actor ? 0 : 1, move: move as CombatEvent['move'], location: 'torso' });
  assert.equal(effect!.when(hit(1, 'light_right'), fighters), true);
  assert.equal(effect!.when(hit(0, 'light_right'), fighters), false, 'a wound the player opens is not his to feed on');
  assert.equal(effect!.when(hit(1, 'kick'), fighters), false);
  assert.equal(effect!.when({ tick: 1, type: 'Blocked', actor: 0, target: 1 }, fighters), false);
});

test('a recalled bead leaves the wound, hangs clear of it, and ends inside the blade tip', () => {
  const from = new THREE.Vector3(0, 1.3, 0), offset = new THREE.Vector3(0.3, 0.2, 0), tip = new THREE.Vector3(0.2, 1.6, 1.5), at = new THREE.Vector3();
  assert.ok(recallPosition(at, from, offset, tip, 0).distanceTo(from) < 1e-9);
  const hanging = recallPosition(at, from, offset, tip, RECALL.burst + RECALL.hang / 2).clone();
  assert.ok(hanging.distanceTo(from) > 0.3, 'it hangs out where it can be seen, not on the wound');
  assert.ok(hanging.distanceTo(tip) > 1, 'it has not started for the blade yet');
  assert.ok(recallPosition(at, from, offset, tip, recallTime).distanceTo(tip) < 1e-9);
});
