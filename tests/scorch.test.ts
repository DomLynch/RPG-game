import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFighter, type CombatEvent } from '../src/duel.ts';
import { initialState } from '../src/sim.ts';
import { SCORCH, scorch, scorchLook, scorches } from '../src/scorch.ts';
import { createSignatureMarks } from '../src/signature.ts';

const fighters = [createFighter(initialState(), 'attack'), createFighter({ ...initialState(), z: 0 }, 'hurt')] as const;
const landed: CombatEvent = { tick: 120, type: 'Hit', actor: 0, target: 1, move: 'skill_witchfire', location: 'torso' };

test('only a Witch-fire that lands scorches: not a block, a parry, a whiff or any other blow', () => {
  assert.equal(scorches(landed), true);
  assert.equal(scorches({ ...landed, type: 'Blocked' }), false);
  assert.equal(scorches({ ...landed, type: 'Parried' }), false);
  assert.equal(scorches({ ...landed, move: 'heavy_overhead' }), false);
  assert.equal(scorches({ ...landed, location: undefined }), false);
});

test('a landed cast burns one mark on the struck body, in the signature pool, and it stays until the fight clears it', () => {
  const scene = new THREE.Scene(), marks = createSignatureMarks(scene), rig = new THREE.Group();
  for (const name of ['spine_03', 'spine_02', 'pelvis', 'Head', 'neck_01', 'thigh_l', 'thigh_r', 'upperarm_l', 'upperarm_r']) { const bone = new THREE.Bone(); bone.name = name; rig.add(bone); }
  const calls: number[] = [];
  const spy = { body: (...args: Parameters<typeof marks.body>) => { calls.push(args[0]); return marks.body(...args); } };
  assert.equal(scorch([landed, { ...landed, type: 'Blocked' }, { ...landed, move: 'thrust' }], fighters, [null, rig], [1, 1], spy), 1);
  assert.deepEqual(calls, [1], 'the struck side, once');
  assert.equal(marks.count('body'), 1);
  for (let k = 0; k < 60; k++) marks.update(1 / 60, null);
  assert.equal(marks.count('body'), 1, 'the scorch stays through the fight');
  marks.clear(); assert.equal(marks.count('body'), 0);
});

test('the look: a hand-span of char, seeded tilt (a replay scorches the same way), and never blood', () => {
  const a = scorchLook(120), b = scorchLook(120), c = scorchLook(121);
  assert.equal(a.width, SCORCH.size); assert.equal(a.tilt, b.tilt); assert.notEqual(a.tilt, c.tilt);
  assert.ok(Math.abs(a.tilt!) <= SCORCH.tilt);
});
