import test from 'node:test';
import assert from 'node:assert/strict';
import { Object3D } from 'three';
import { finisherBloodSources } from '../src/finisher-blood.ts';
import { HAMSTRUNG_BEATS } from '../src/hamstrung.ts';

// A victim of bare bones: neck, head, chest and the right calf, 1 m tall.
function victim() {
  const root = new Object3D();
  for (const [name, y] of [['neck_01', 1.45], ['Head', 1.53], ['spine_02', 1.2], ['calf_r', 0.3]] as const) { const bone = new Object3D(); bone.name = name; bone.position.set(0, y, 0); root.add(bone); }
  root.updateMatrixWorld(true);
  return root;
}

test('Hamstrung blood: two wounds on the beats, each throwing its first drops the frame it opens, the back spray tilted up', () => {
  const [knee, back] = finisherBloodSources('hamstrung', victim(), null);
  assert.deepEqual([knee.site, back.site], ['knee-cut', 'back-entry']);
  assert.equal(knee.delay, HAMSTRUNG_BEATS.knee * HAMSTRUNG_BEATS.duration);
  assert.equal(back.delay, HAMSTRUNG_BEATS.back * HAMSTRUNG_BEATS.duration + HAMSTRUNG_BEATS.hold);
  assert.deepEqual([knee.seed, back.seed], [8, 8]);
  assert.ok(knee.strength > 0.9 && back.strength > knee.strength, 'readable at 375: the knee over a 1.0 trickle, the back above it');
  assert.ok(back.direction.y > 0.3, 'the back spray rises, so it shows against the dark armour');
  assert.ok(back.strength * 78 < 160, 'one burst never outruns the 160-drop pool in a frame');
});
