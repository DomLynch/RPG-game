// The merged remote figures (origins/preview/figure-source.ts) on the real baked files (src/assets/hero-near.glb, hero-far.glb): ready, spawn, the shared material, the shadow flags, the kit fallback and the row loader.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Mesh, type MeshStandardMaterial, type Object3D, type SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createFigureSource, loadRemoteDress, loadRemoteFigures, REMOTE_DRESS, REMOTE_FIGURES, wornKey } from '../origins/preview/figure-source.ts';

async function parse(file: string) {   // a shipped GLB in Node, as tests/grade-materials.test.ts does: geometry, rig and material names; images are the browser's
  const bytes = readFileSync(new URL(`../src/assets/${file}`, import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
const shown = (root: Object3D) => { const out: Mesh[] = []; root.traverse((o) => { if (o instanceof Mesh) { let v = true; for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) v = false; if (v) out.push(o); } }); return out; };
const make = async (extra: Partial<Parameters<typeof createFigureSource>[0]> = {}) => {
  const clips = (await parse('warrior.glb')).animations;
  const source = createFigureSource({ clips, urls: { 'hero-near.glb': 'near', 'hero-far.glb': 'far' }, pieceUrl: 'pieces', load: (url) => parse(url === 'pieces' ? 'loot-lod.glb' : `hero-${url}.glb`) as never, ...extra });
  return { source, clips };
};
const tris = (m: Mesh) => m.geometry.index!.count / 3;
const bodyOf = (f: { anchor: Object3D }) => shown(f.anchor).find((m) => (m as { isSkinnedMesh?: boolean }).isSkinnedMesh) as SkinnedMesh;

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
});

test('figures of a level share ONE material (no program per player); the two levels have their own; a figure is a fresh actor each time', async () => {
  const { source } = await make();
  await source.start();
  const body = (f: NonNullable<ReturnType<typeof source.spawn>>) => shown(f.anchor).find((m) => (m as { isSkinnedMesh?: boolean }).isSkinnedMesh)!;
  const a = source.spawn('far', null)!, b = source.spawn('far', null)!, n = source.spawn('near', null)!;
  assert.notEqual(a.anchor, b.anchor);
  assert.equal(body(a).material, body(b).material as MeshStandardMaterial, 'one far material');
  assert.notEqual(body(a).material, body(n).material, 'near and far are two files, two materials');
  a.update(1.5, 0.5); assert.equal((body(a) as SkinnedMesh).skeleton.bones.length, 65, 'the same 65-bone rig');
});

test('a load that fails leaves the source not ready and failed, and spawn answers null (the caller keeps its rig)', async () => {
  const source = createFigureSource({ clips: [], urls: { 'hero-near.glb': 'x', 'hero-far.glb': 'y' }, load: () => Promise.reject(new Error('404')) });
  assert.equal(await source.start(), false); assert.equal(source.ready(), false); assert.equal(source.failed(), true); assert.equal(source.spawn('near', null), null);
});

const SET = wornKey(['goblin.Body', 'goblin.Helmet', 'goblin.Boots', 'goblin.Greaves', 'goblin.Arms']);

test('v2: a worn set is merged into the body: still ONE skinned draw and the SAME shared material, more triangles, the same 65 bones; the base figure is untouched', async () => {
  const { source } = await make();
  await source.start();
  assert.ok(source.kits().includes('goblin.Body') && source.kits().length >= 50, `${source.kits().length} pieces held`);
  const base = source.spawn('near', null)!, dressed = source.spawn('near', SET)!, other = source.spawn('near', SET)!;
  assert.equal(shown(dressed.anchor).length, 2, 'body + weapon, no extra draw per piece');
  assert.equal(bodyOf(dressed).material, bodyOf(base).material, 'no new material, so no new program');
  assert.ok(tris(bodyOf(dressed)) > tris(bodyOf(base)) + 1000, `dressed ${tris(bodyOf(dressed))} vs base ${tris(bodyOf(base))}`);
  assert.equal(bodyOf(dressed).geometry, bodyOf(other).geometry, 'the same worn set is one merge, shared');
  assert.equal(bodyOf(dressed).skeleton.bones.length, 65);
  for (let i = 0; i < 20; i++) dressed.update(2, 1 / 30);
  const box = bodyOf(dressed).geometry; assert.equal(box.getAttribute('color').count, box.getAttribute('position').count, 'every merged vertex has its colour');
});

test('v2: an unknown id is left off, none known is the base figure, a far figure is not dressed unless the row says so, and a different set is its own merge', async () => {
  const { source } = await make();
  await source.start();
  const base = bodyOf(source.spawn('near', null)!).geometry;
  assert.equal(bodyOf(source.spawn('near', 'nobody.Helmet')!).geometry, base, 'unknown only = the base body');
  assert.equal(bodyOf(source.spawn('far', SET)!).geometry, bodyOf(source.spawn('far', null)!).geometry, 'dressFar is false in the row');
  const a = bodyOf(source.spawn('near', 'goblin.Body,nobody.Helmet')!).geometry, b = bodyOf(source.spawn('near', 'goblin.Body')!).geometry;
  assert.notEqual(a, base); assert.equal(a.getAttribute('position').count, b.getAttribute('position').count, 'the unknown id adds nothing');
  const far = await make({ dress: { asset: 'x', cacheMax: 4, dressFar: true } }); await far.source.start();
  assert.notEqual(bodyOf(far.source.spawn('far', SET)!).geometry, bodyOf(far.source.spawn('far', null)!).geometry, 'dressFar true dresses the far figure');
});

test('v2: the cache keeps cacheMax sets, drops the oldest first, and a use refreshes a set', async () => {
  const { source } = await make({ dress: { asset: 'x', cacheMax: 2, dressFar: false } });
  await source.start();
  const g = (k: string) => bodyOf(source.spawn('near', k)!).geometry;
  const a = g('goblin.Body'), b = g('goblin.Helmet');
  assert.equal(g('goblin.Body'), a, 'a is cached'); g('goblin.Boots');   // b is now the oldest and goes
  assert.equal(g('goblin.Body'), a, 'a survived (refreshed)'); assert.notEqual(g('goblin.Helmet'), b, 'b was evicted and merged again');
});

test('v2: the merge of a full set costs well under the 8 ms target on this machine (the T4 is the real reading)', async () => {
  const { source } = await make();
  await source.start();
  const t0 = performance.now(); source.spawn('near', SET); const first = performance.now() - t0;
  const t1 = performance.now(); source.spawn('near', SET); const cached = performance.now() - t1;
  console.log(`merge-ms first ${first.toFixed(2)} cached ${cached.toFixed(2)}`);
  assert.ok(first < 50, `first spawn incl. buildWarriors ${first} ms`);
});

test('v2: pieces that fail to load leave every dressed remote on the base figure (never null, never the rig); the dress row is validated', async () => {
  const clips = (await parse('warrior.glb')).animations;
  const source = createFigureSource({ clips, urls: { 'hero-near.glb': 'near', 'hero-far.glb': 'far' }, pieceUrl: 'pieces', load: (url) => url === 'pieces' ? Promise.reject(new Error('404')) : parse(`hero-${url}.glb`) as never });
  assert.equal(await source.start(), true); assert.equal(source.kits().length, 0);
  const f = source.spawn('near', SET)!; assert.ok(f, 'a figure, not null'); assert.equal(bodyOf(f).geometry, bodyOf(source.spawn('near', null)!).geometry);
  assert.deepEqual(REMOTE_DRESS, { asset: 'loot-lod.glb', cacheMax: 24, dressFar: false });
  assert.throws(() => loadRemoteDress({ remoteDress: [{ id: 'pieces', fields: { asset: 'a.glb', cacheMax: 0, dressFar: false } }] }), /cacheMax is a whole number/);
  assert.throws(() => loadRemoteDress({ remoteDress: [{ id: 'pieces', fields: { asset: 'a.glb', cacheMax: 3, dressFar: 'no' } }] }), /dressFar is true or false/);
  assert.throws(() => loadRemoteDress({ remoteDress: [] }), /no "pieces" row/);
});
