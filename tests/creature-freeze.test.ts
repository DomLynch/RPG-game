// creature-freeze.ts (mobs-view.ts): a hidden or far creature is out of the scene's matrix walk and its skeletons idle; the frame it is posed (the first frame back after it was hidden, or its every-4th pose
// frame) its bones and root are current for that frame's render.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Bone, BufferGeometry, Group, MeshBasicMaterial, Skeleton, SkinnedMesh, Vector3 } from 'three';
import { freeze, newIce, pose, wrapSkeletons } from '../origins/preview/creature-freeze.ts';

/** A creature as mobs-view builds it: a group in a root, holding a rig (a two-bone chain and a skinned mesh). `runs()` counts the skeleton updates that really ran (the counter sits under the freeze wrapper). */
function creature() {
  const root = new Group(), group = new Group(), anchor = new Group(), hip = new Bone(), arm = new Bone(); hip.add(arm); arm.position.set(0, 1, 0);
  const mesh = new SkinnedMesh(new BufferGeometry(), new MeshBasicMaterial()); anchor.add(hip, mesh); mesh.bind(new Skeleton([hip, arm]));
  group.add(anchor); root.add(group);
  let runs = 0; const real = mesh.skeleton.update.bind(mesh.skeleton); mesh.skeleton.update = () => { runs++; real(); };
  const ice = newIce(); wrapSkeletons(anchor, ice);
  const render = () => { root.updateMatrixWorld(true); mesh.skeleton.update(); };   // the scene's walk, then the render's skeleton call for a drawn skin
  return { root, group, mesh, arm, ice, runs: () => runs, render };
}
const world = (o: { getWorldPosition(v: Vector3): Vector3 }) => o.getWorldPosition(new Vector3());

test('a frozen creature is skipped by scene.updateMatrixWorld; thawing restores the walk', () => {
  const c = creature();
  c.group.position.set(5, 0, 0); c.root.updateMatrixWorld(true);
  freeze(c.group, c.ice, true); c.group.position.set(40, 0, 0); c.root.updateMatrixWorld(true);
  assert.equal(c.arm.matrixWorld.elements[12], 5, 'frozen: the bone still stands where it was posed');
  freeze(c.group, c.ice, false); c.root.updateMatrixWorld(true);
  assert.equal(c.arm.matrixWorld.elements[12], 40, 'thawed: the walk reaches it again');
});

test('a creature walking back into view is posed correctly on its FIRST frame: pose() brings its bones and root current, and its skeleton runs for that frame', () => {
  const c = creature();
  c.group.position.set(5, 0, 0); c.render(); assert.equal(c.runs(), 1, 'unfrozen: runs');
  freeze(c.group, c.ice, true);   // hidden: out of view and out of the walk
  for (let f = 0; f < 10; f++) { c.group.position.x += 3; c.render(); }
  assert.equal(c.runs(), 1, 'no skeleton update while frozen');
  assert.equal(c.arm.matrixWorld.elements[12], 5, 'and its bones are where they were');
  // the first frame back: position set, the actor's update (not modelled here), then freeze(true) + pose(), then the scene's walk and the render
  freeze(c.group, c.ice, true); pose(c.group, c.ice); c.render();
  assert.equal(c.runs(), 2, "the pose frame's skeleton update runs");
  assert.deepEqual([world(c.group).x, world(c.arm).x, world(c.arm).y], [35, 35, 1], 'root and bone are at the creature position on that frame');
  assert.ok(Math.abs(c.mesh.skeleton.boneMatrices[16 + 12] - 35) < 1e-6 && Math.abs(c.mesh.skeleton.boneMatrices[16 + 13] - 1) < 1e-6, 'and the skeleton matrices carry it: the render draws the new pose, not the stale one');
  freeze(c.group, c.ice, true); c.render(); assert.equal(c.runs(), 2, 'the next frozen frame idles again');
});

test('a far creature poses on its pose frames only, and a near one is never frozen', () => {
  const c = creature();
  for (let f = 1; f <= 8; f++) { freeze(c.group, c.ice, true); if (f % 4 === 0) pose(c.group, c.ice); c.render(); }
  assert.equal(c.runs(), 2, 'frames 4 and 8');
  for (let f = 0; f < 5; f++) { freeze(c.group, c.ice, false); c.render(); }
  assert.equal(c.runs(), 7, 'near: every frame');
  assert.equal(c.group.matrixWorldAutoUpdate, true);
});
