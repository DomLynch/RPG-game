import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { HERO_BONES, NotHeroRig, assertHeroRig, boneRatios, fitPieces } from '../src/fight/piece-fit.ts';
import { fxNum } from '../src/fight/fx-rows.ts';

// Promoted from the Test Zone (origins/preview/piece-fit.test.ts, zone/goblin-field-dome @ebd020da9) onto the hero's real 65 bone names: a chain along +Y, one metre-ish segment per bone,
// `seg(i)` its length for the body (so a test can make one bone's segment differ), `k` the whole-body scale.
const chain = (k: number, seg: (i: number) => number = () => 1): THREE.Skeleton => {
  const bones = HERO_BONES.map((name) => { const b = new THREE.Bone(); b.name = name; return b; });
  bones.forEach((b, i) => { if (i > 0) { bones[i - 1]!.add(b); b.position.y = seg(i) * k; } });
  bones[0]!.updateMatrixWorld(true);
  return new THREE.Skeleton(bones);
};
const idx = (name: string): number => HERO_BONES.indexOf(name);

test('the rows are the numbers the Test Zone proved the fit with, and the hero rig row is 65 bones with no repeats', () => {
  assert.deepEqual([fxNum('fit.min-len-m'), fxNum('fit.ratio-min'), fxNum('fit.ratio-max')], [0.02, 0.5, 3]);
  assert.equal(HERO_BONES.length, 65);
  assert.equal(new Set(HERO_BONES).size, 65);
});

test('the hero rig row is exactly the bones of the hero body (src/assets/warrior.glb), so the row cannot drift from the art', () => {
  const bytes = readFileSync(new URL('../src/assets/warrior.glb', import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  const named = (json.skins[0].joints as number[]).map((i) => json.nodes[i].name as string);
  assert.deepEqual([...HERO_BONES].sort(), [...named].sort());
});

test('the ratio per bone is the body segment over the hero segment (a uniform 2x body gives 2 everywhere a segment exists, 1 for the root)', () => {
  const r = boneRatios(chain(1), chain(2));
  assert.equal(r.get('root'), 1);
  for (const name of ['pelvis', 'spine_02', 'Head', 'hand_l', 'ball_leaf_r']) assert.ok(Math.abs(r.get(name)! - 2) < 1e-6, `${name} ${r.get(name)}`);
});

test('per bone, not one number: a body whose spine_01 segment is 3x but whose Head segment is 1.5x gets each', () => {
  const spine = idx('spine_01'), head = idx('Head'), body = chain(1, (i) => (i === spine ? 3 : i === head ? 1.5 : 1));
  const r = boneRatios(chain(1), body);
  assert.ok(Math.abs(r.get('spine_01')! - 3) < 1e-6); assert.ok(Math.abs(r.get('Head')! - 1.5) < 1e-6); assert.ok(Math.abs(r.get('spine_02')! - 1) < 1e-6);
});

test('the ratio stays inside the rows limits (a collapsed or exploded body never drives a piece to nothing or to the horizon)', () => {
  const huge = boneRatios(chain(1), chain(1000)), tiny = boneRatios(chain(1), chain(0.001));
  assert.ok(huge.get('spine_01')! <= fxNum('fit.ratio-max') + 1e-9, `got ${huge.get('spine_01')}`);
  assert.ok(tiny.get('spine_01')! >= fxNum('fit.ratio-min') - 1e-9, `got ${tiny.get('spine_01')}`);
});

test('fitPieces scales the piece\'s inverse binds by the bone ratio and leaves the original piece and geometry untouched', () => {
  const hero = chain(1), rig = chain(2), geometry = new THREE.BufferGeometry(), material = new THREE.MeshBasicMaterial();
  const piece = new THREE.SkinnedMesh(geometry, material); piece.bind(hero);
  const before = hero.boneInverses.map((m) => m.clone());
  const [fitted] = fitPieces([piece], rig);
  assert.notEqual(fitted, piece); assert.equal(fitted!.geometry, geometry); assert.equal(fitted!.material, material);
  hero.boneInverses.forEach((m, i) => assert.ok(m.equals(before[i]!), 'the source skeleton is untouched'));
  // at the body's bind pose a vertex weighted wholly to a bone lands at bodyJoint + ratio * (p - heroJoint)
  const j = idx('spine_02'), p = new THREE.Vector3(0.3, 1.2, 0.1);
  const heroJoint = new THREE.Vector3().setFromMatrixPosition(hero.boneInverses[j]!.clone().invert()), bodyJoint = new THREE.Vector3().setFromMatrixPosition(rig.boneInverses[j]!.clone().invert());
  const bodyBind = rig.boneInverses[j]!.clone().invert(), placed = p.clone().applyMatrix4(fitted!.skeleton.boneInverses[j]!).applyMatrix4(bodyBind);
  const want = bodyJoint.clone().add(p.clone().sub(heroJoint).multiplyScalar(2));
  assert.ok(placed.distanceTo(want) < 1e-5, `placed ${placed.toArray()} want ${want.toArray()}`);
  const [a, b] = fitPieces([piece, piece], rig); assert.equal(a!.skeleton, b!.skeleton, 'pieces on one source skeleton share one fitted skeleton');
});

test('a rig that is not the hero\'s 65-bone biped is refused loudly (NotHeroRig), never fitted on a guess or passed through', () => {
  const hero = chain(1), piece = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()); piece.bind(hero);
  const short = new THREE.Skeleton(chain(1).bones.filter((b) => b.name !== 'Head'));
  assert.throws(() => fitPieces([piece], short), (e: unknown) => e instanceof NotHeroRig && e.what === 'rig' && e.missing.includes('Head') && /65/.test(e.message));
  assert.throws(() => assertHeroRig(new THREE.Skeleton([new THREE.Bone()])), NotHeroRig);
  const stray = chain(1); stray.bones[stray.bones.length - 1]!.name = 'tail_01';
  const odd = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()); odd.bind(stray);
  assert.throws(() => fitPieces([odd], chain(2)), (e: unknown) => e instanceof NotHeroRig && e.what === 'piece' && e.missing.includes('tail_01'));
});

test('the goblin body carries all 65 hero bones, so the fit accepts it', () => {
  for (const file of ['goblin.glb']) {
    const bytes = readFileSync(new URL(`../src/assets/${file}`, import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
    const have = new Set((json.skins[0].joints as number[]).map((i) => json.nodes[i].name as string));
    assert.deepEqual(HERO_BONES.filter((n) => !have.has(n)), [], file);
  }
});
