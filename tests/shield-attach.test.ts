import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Bone, BufferGeometry, Float32BufferAttribute, Matrix4, Quaternion, Skeleton, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { armWarriors, buildWarriors, gripFit, SHIELD_CARRIERS } from '../src/characters.ts';
import { shieldFor, SHIPPING_SHIELDS } from '../src/shields.ts';

test('shieldFor: the band file per rank, the Centurion stem, no rank-1 Centurion shield, nothing without the flag or for another opponent', () => {
  assert.equal(shieldFor('shieldmaiden', 1, true), '/shields/shieldmaiden-plain.glb');
  assert.equal(shieldFor('shieldmaiden', 4, true), '/shields/shieldmaiden-crafted.glb');
  assert.equal(shieldFor('shieldmaiden', 10, true), '/shields/shieldmaiden-ornate.glb');
  assert.equal(shieldFor('veteran', 2, true), '/shields/centurion-plain.glb');
  assert.equal(shieldFor('veteran', 1, true), undefined, 'the Centurion fights his trident at Recruit with no shield');
  assert.equal(shieldFor('shieldmaiden', 5, false), undefined);
  assert.equal(shieldFor('goblin', 5, true), undefined);
  assert.deepEqual([...SHIPPING_SHIELDS].sort(), ['shieldmaiden', 'veteran'], 'both painted sets ship (Strategy 2026-10-01)');
});

test('gripFit: the grip origin lands on the bone\'s bind joint and every vertex is skinned 100 % to it', () => {
  const hand = new Bone(); hand.name = 'hand_l';
  const other = new Bone(); other.name = 'spine';
  const skeleton = new Skeleton([other, hand], [new Matrix4(), new Matrix4().makeTranslation(-.706, -1.455, .065)]);   // hand_l's bind joint at (0.706, 1.455, −0.065)
  const board = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, .1, 0, .1, 0, .2, .1], 3));
  const fitted = gripFit(board, skeleton, 'hand_l'), p = fitted.getAttribute('position');
  assert.deepEqual([p.getX(0), p.getY(0), p.getZ(0)].map(v => +v.toFixed(3)), [.706, 1.455, -.065]);
  assert.ok(Math.abs(p.getX(1) - .806) < 1e-6 && Math.abs(p.getZ(1) - .035) < 1e-6, 'the board keeps its own shape about the grip');
  for (let i = 0; i < 3; i++) { assert.equal(fitted.getAttribute('skinIndex').getX(i), 1); assert.equal(fitted.getAttribute('skinWeight').getX(i), 1); }
  assert.equal(board.getAttribute('position').getX(0), 0, 'the source piece is not touched (it is worn on every re-dress)');
  assert.throws(() => gripFit(board, skeleton, 'hand_x'), /no hand_x/);
});

// Parse a GLB in Node with its images dropped (decoding is the browser's), as tests/shield-carry.test.ts does.
async function parse(url: URL) {
  const bytes = readFileSync(url), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.extensionsRequired = []; json.extensionsUsed = []; json.materials = (json.materials ?? []).map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
// The painted boards worn on the carried arm (the real rigs, every band's file): where the board faces at ready, and the lowest posed vertex
// over every defence pose and the roll (the floor is y = 0; Strategy 2026-10-01: flag any frame where the board dips under it).
for (const [rig, stem] of [['shieldmaiden', 'shieldmaiden'], ['veteran', 'centurion']]) for (const band of ['plain', 'crafted', 'ornate']) {
  test(`the painted ${stem}-${band} board on ${rig}: faces front at ready and stays above the floor in every defence pose and the roll`, async () => {
    const asset = await parse(new URL(`../src/assets/${rig}.glb`, import.meta.url)), shield = await parse(new URL(`../public/shields/${stem}-${band}.glb`, import.meta.url));
    let mesh: SkinnedMesh | undefined; shield.scene.traverse(o => { if ((o as { isMesh?: boolean }).isMesh) mesh ??= o as SkinnedMesh; });
    const piece = new SkinnedMesh(mesh!.geometry.clone().applyMatrix4(mesh!.matrixWorld), mesh!.material); piece.userData = { slot: 'Shield', layer: 'over', painted: true, gripBone: 'hand_l' };
    // A real carry, as the game opts the rig in: armWarriors with the flag SHIELD_CARRIERS gives it (not a forced withShieldCarry).
    armWarriors(await parse(new URL('../src/assets/warrior.glb', import.meta.url)), asset, ['longsword', 'gladius'], undefined, () => {}, SHIELD_CARRIERS.has(rig));
    assert.equal(asset.scene.userData.shieldCarry, true, `the game opts ${rig} in to the carry (SHIELD_CARRIERS)`);
    const { player } = buildWarriors(asset, undefined, ['gladius', 'gladius']);
    player.wear([piece]);
    assert.equal(player.worn().length, 1);
    let hand: { getWorldQuaternion: (q: Quaternion) => Quaternion } | undefined; player.anchor.traverse(o => { if (o.name === 'hand_l') hand ??= o; });
    let inverse: Matrix4 | undefined; player.anchor.traverse(o => { if (!inverse && o instanceof SkinnedMesh) { const i = o.skeleton.bones.findIndex(b => b.name === 'hand_l'); if (i >= 0) inverse = o.skeleton.boneInverses[i]; } });
    for (let i = 0; i < 30; i++) player.update(0, 1 / 30, 'ready', 0);
    const face = new Vector3(0, 0, 1).transformDirection(inverse!).applyQuaternion(hand!.getWorldQuaternion(new Quaternion())).normalize();
    assert.ok(face.z > .7, `at ready the board faces front (${face.toArray().map(v => v.toFixed(2))})`);
    let low = Infinity;
    for (const pose of ['ready', 'guard', 'block', 'parry', 'deflected', 'hit', 'roll'] as const) for (let p = 0; p <= 1.0001; p += .1) {
      player.update(0, 1 / 30, pose, p); player.anchor.updateMatrixWorld(true);
      for (const m of player.worn()) { m.skeleton.update(); const pos = m.geometry.getAttribute('position'); for (let i = 0; i < pos.count; i++) low = Math.min(low, m.applyBoneTransform(i, new Vector3().fromBufferAttribute(pos, i)).y); }
    }
    console.log(`${stem}-${band} on ${rig}: lowest posed vertex ${low.toFixed(3)} m, face z ${face.z.toFixed(2)}`);
    assert.ok(low > 0, `the board stays above the floor (lowest ${low.toFixed(3)} m)`);
  });
}
