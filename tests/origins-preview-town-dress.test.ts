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

test('the clothes file is garments and one Talk clip: no body mesh, every piece skinned, 670 triangles or fewer', async () => {
  const clothes = await parse('town/clothes.glb');
  const meshes: SkinnedMesh[] = []; clothes.scene.traverse((o) => { if (o instanceof SkinnedMesh) meshes.push(o); });
  assert.deepEqual(meshes.map((m) => m.name).sort(), CLOTH_PIECES.map((p) => `Cloth_${p}`).sort(), 'exactly the eight pieces, nothing else skinned (no body)');
  assert.deepEqual(clothes.animations.map((a) => a.name), ['Talk'], 'one clip: Idle and Walk are the body\'s own');
  assert.ok(clothesTriangles(meshes) <= 670, `${clothesTriangles(meshes)} triangles`);
  assert.ok(talkClip(clothes.animations)!.duration > 1.5, 'a gesture loop of about two seconds');
});

test('worn on the warrior world body, every garment is bound to the BODY\'s bones, with the same inverse binds (no new rig)', async () => {
  const [body, clothes] = await Promise.all([parse('warrior.glb'), parse('town/clothes.glb')]);
  const bones = boneMap(body.scene), worn = wearClothes(body.scene, clothes.scene, BANKER_OUTFIT);
  assert.equal(worn.length, BANKER_OUTFIT.pieces.length);
  const inverseOf = new Map<string, Matrix4>(); body.scene.traverse((o) => { if (o instanceof SkinnedMesh && !worn.includes(o)) o.skeleton.bones.forEach((b, i) => inverseOf.set(b.name, o.skeleton.boneInverses[i]!)); });
  for (const w of worn) w.skeleton.bones.forEach((b, i) => {
    assert.equal(b, bones.get(b.name), `${w.name}: ${b.name} is the body's own bone, not the clothes file's`);
    const want = inverseOf.get(b.name); if (want) assert.ok(w.skeleton.boneInverses[i]!.equals(want) || w.skeleton.boneInverses[i]!.elements.every((e, k) => Math.abs(e - want.elements[k]!) < 1e-3), `${w.name}: ${b.name} has the body's rest pose`);
  });
  const talk = talkClip(clothes.animations)!;
  assert.ok(talk.tracks.every((t) => bones.has(t.name.split('.')[0]!)), 'every Talk track names a bone the body has');
});

test('a piece the file lacks throws; an outfit is a stable function of its seed: one body garment, never both alternatives, at most one headgear, an apron only over a tunic', async () => {
  const [body, clothes] = await Promise.all([parse('warrior.glb'), parse('town/clothes.glb')]);
  assert.throws(() => wearClothes(body.scene, clothes.scene, { pieces: ['cloak' as never], tint: 0xffffff }), /no skinned piece Cloth_cloak/);
  assert.deepEqual(outfitFor('character:smith-orla'), outfitFor('character:smith-orla'));
  const seen = new Set<string>(), tints = new Set<number>();
  for (let i = 0; i < 400; i++) {
    const { pieces, tint } = outfitFor(`npc-${i}`); tints.add(tint);
    assert.equal(pieces.filter((p) => p === 'robe' || p === 'tunic').length, 1, `${pieces}: exactly one of robe | tunic`);
    assert.ok(pieces.filter((p) => p === 'cap' || p === 'hat' || p === 'hood').length <= 1, `${pieces}: at most one headgear`);
    assert.ok(!pieces.includes('apron') || pieces.includes('tunic'), `${pieces}: an apron only over a tunic`);
    pieces.forEach((p) => seen.add(p));
  }
  assert.deepEqual([...seen].sort(), [...CLOTH_PIECES].sort(), '400 townspeople between them wear every piece');
  assert.ok(tints.size > 4, 'the tint pool varies');
  for (const piece of CLOTH_PIECES) wearClothes(body.scene, clothes.scene, { pieces: [piece], tint: 0x808080 });   // every piece binds to the body's bones
});
