// Townspeople clothes (origins/preview/town-dress.ts): the garments of public/world/town/clothes.glb ride the warrior world body's OWN bones by name, so they
// play the body's clips; the file carries the Talk clip and no body. Parsed in Node with images dropped, as tests/rank-look.test.ts does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Bone, Matrix4, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { BANKER_OUTFIT, CLOTH_PIECES, clothesTriangles, outfitFor, talkClip, wearClothes } from '../origins/preview/town-dress.ts';

async function parse(file: string) {
  const bytes = readFileSync(new URL(`../public/world/${file}`, import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(json), '');
}
const boneMap = (root: { traverse(cb: (o: unknown) => void): void }) => { const m = new Map<string, Bone>(); root.traverse((o) => { if (o instanceof Bone) m.set(o.name, o); }); return m; };

test('the clothes file is garments and one Talk clip: no body mesh, every piece skinned, 380 triangles or fewer', async () => {
  const clothes = await parse('town/clothes.glb');
  const meshes: SkinnedMesh[] = []; clothes.scene.traverse((o) => { if (o instanceof SkinnedMesh) meshes.push(o); });
  assert.deepEqual(meshes.map((m) => m.name).sort(), CLOTH_PIECES.map((p) => `Cloth_${p}`).sort(), 'exactly the four pieces, nothing else skinned (no body)');
  assert.deepEqual(clothes.animations.map((a) => a.name), ['Talk'], 'one clip: Idle and Walk are the body\'s own');
  assert.ok(clothesTriangles(meshes) <= 380, `${clothesTriangles(meshes)} triangles`);
  assert.ok(talkClip(clothes.animations)!.duration > 1.5, 'a gesture loop of about two seconds');
});

test('worn on the warrior world body, every garment is bound to the BODY\'s bones, with the same inverse binds (no new rig)', async () => {
  const [body, clothes] = await Promise.all([parse('warrior.glb'), parse('town/clothes.glb')]);
  const bones = boneMap(body.scene), worn = wearClothes(body.scene, clothes.scene, BANKER_OUTFIT);
  assert.equal(worn.length, 4);
  const inverseOf = new Map<string, Matrix4>(); body.scene.traverse((o) => { if (o instanceof SkinnedMesh && !worn.includes(o)) o.skeleton.bones.forEach((b, i) => inverseOf.set(b.name, o.skeleton.boneInverses[i]!)); });
  for (const w of worn) w.skeleton.bones.forEach((b, i) => {
    assert.equal(b, bones.get(b.name), `${w.name}: ${b.name} is the body's own bone, not the clothes file's`);
    const want = inverseOf.get(b.name); if (want) assert.ok(w.skeleton.boneInverses[i]!.equals(want) || w.skeleton.boneInverses[i]!.elements.every((e, k) => Math.abs(e - want.elements[k]!) < 1e-3), `${w.name}: ${b.name} has the body's rest pose`);
  });
  const talk = talkClip(clothes.animations)!;
  assert.ok(talk.tracks.every((t) => bones.has(t.name.split('.')[0]!)), 'every Talk track names a bone the body has');
});

test('a piece the file lacks throws; an outfit is a stable function of its seed (the robe always, a tint from the pool)', async () => {
  const [body, clothes] = await Promise.all([parse('warrior.glb'), parse('town/clothes.glb')]);
  assert.throws(() => wearClothes(body.scene, clothes.scene, { pieces: ['apron' as never], tint: 0xffffff }), /no skinned piece Cloth_apron/);
  assert.deepEqual(outfitFor('character:smith-orla'), outfitFor('character:smith-orla'));
  for (const id of ['a', 'b', 'character:banker-exchange', 'character:smith-orla', 'x1', 'x2', 'x3']) assert.ok(outfitFor(id).pieces.includes('robe'), id);
  assert.ok(new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((s) => outfitFor(s).tint)).size > 1, 'the pool varies');
});
