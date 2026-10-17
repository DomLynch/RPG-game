// The merged remote figures (origins/preview/figure-source.ts) on the real baked files (src/assets/hero-near.glb, hero-far.glb): ready, spawn, the shared material, the shadow flags, the kit fallback and the row loader.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createFigureSource, loadRemoteFigures, REMOTE_FIGURES } from '../origins/preview/figure-source.ts';

async function parse(file: string) {   // a shipped GLB in Node, as tests/grade-materials.test.ts does: geometry, rig and material names; images are the browser's
  const bytes = readFileSync(new URL(`../src/assets/${file}`, import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
const shown = (root: Object3D) => { const out: Mesh[] = []; root.traverse((o) => { if (o instanceof Mesh) { let v = true; for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) v = false; if (v) out.push(o); } }); return out; };
const make = async () => {
  const clips = (await parse('warrior.glb')).animations;
  const source = createFigureSource({ clips, urls: { 'hero-near.glb': 'near', 'hero-far.glb': 'far' }, load: (url) => parse(`hero-${url}.glb`) as never });
  return { source, clips };
};

test('the rows: a near and a far figure, near casts a shadow and far does not; a missing row, a bad shadow flag and a missing file name are refused', () => {
  assert.deepEqual([...REMOTE_FIGURES].map(([id, r]) => [id, r.asset, r.castShadow]), [['hero:near', 'hero-near.glb', true], ['hero:far', 'hero-far.glb', false]]);
  assert.throws(() => loadRemoteFigures({ remoteFigures: [{ id: 'hero:near', fields: { asset: 'a.glb', castShadow: true } }] }), /no "hero:far" row/);
  assert.throws(() => loadRemoteFigures({ remoteFigures: [{ id: 'hero:near', fields: { asset: 'a.glb', castShadow: 'yes' } }, { id: 'hero:far', fields: { asset: 'b.glb', castShadow: false } }] }), /castShadow is true or false/);
  assert.throws(() => loadRemoteFigures({ remoteFigures: [{ id: 'hero:near', fields: { castShadow: true } }, { id: 'hero:far', fields: { asset: 'b.glb', castShadow: false } }] }), /asset is the glb file name/);
});

test('not ready until started; then each level spawns a figure of one body and one weapon draw, and a kit this source does not hold is null', async () => {
  const { source } = await make();
  assert.equal(source.ready(), false); assert.equal(source.spawn('near', null), null, 'null until ready');
  assert.equal(await source.start(), true); assert.equal(source.ready(), true); assert.deepEqual(source.kits(), []);
  for (const lod of ['near', 'far'] as const) {
    const figure = source.spawn(lod, null)!;
    assert.ok(figure, `${lod} spawns`);
    for (let i = 0; i < 20; i++) figure.update(2, 1 / 30);
    const draws = shown(figure.anchor);
    assert.equal(draws.length, 2, `${lod}: the body and one weapon, nothing else drawn (${draws.map((m) => m.name).join(', ')})`);
    assert.equal(draws.filter((m) => (m as { isSkinnedMesh?: boolean }).isSkinnedMesh).length, 1, `${lod}: one skinned mesh`);
    assert.equal(draws.every((m) => m.castShadow === (lod === 'near')), true, `${lod}: shadow flag from the row`);
  }
  assert.equal(source.spawn('near', 'goblin-body'), null, 'v1 holds the base hero only: the caller keeps its rig for a kit');
});

test('figures of a level share ONE material (no program per player); the two levels have their own; a figure is a fresh actor each time', async () => {
  const { source } = await make();
  await source.start();
  const body = (f: NonNullable<ReturnType<typeof source.spawn>>) => shown(f.anchor).find((m) => (m as { isSkinnedMesh?: boolean }).isSkinnedMesh)!;
  const a = source.spawn('far', null)!, b = source.spawn('far', null)!, n = source.spawn('near', null)!;
  assert.notEqual(a.anchor, b.anchor);
  assert.equal(body(a).material, body(b).material as MeshStandardMaterial, 'one far material');
  assert.notEqual(body(a).material, body(n).material, 'near and far are two files, two materials');
  a.update(1.5, 0.5); assert.ok(body(a).skeleton.bones.length === 65, 'the same 65-bone rig');
});

test('a load that fails leaves the source not ready and failed, and spawn answers null (the caller keeps its rig)', async () => {
  const source = createFigureSource({ clips: [], urls: { 'hero-near.glb': 'x', 'hero-far.glb': 'y' }, load: () => Promise.reject(new Error('404')) });
  assert.equal(await source.start(), false); assert.equal(source.ready(), false); assert.equal(source.failed(), true); assert.equal(source.spawn('near', null), null);
});
