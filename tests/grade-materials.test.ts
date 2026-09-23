import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Color, Mesh, MeshStandardMaterial, type SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildWarriors, gradeMaterial, lootId, lootPiecesOf } from '../src/characters.ts';
import { GRADES } from '../src/grades.ts';

// Parse a shipped GLB in Node, as tests/loot-wear.test.ts does: geometry, rig and material names; images are the browser's.
async function parse(file: string) {
  const bytes = readFileSync(new URL(`../src/assets/${file}`, import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
const hex = (m: MeshStandardMaterial) => `#${m.color.getHexString()}`;
const finish = (m: MeshStandardMaterial) => ({ color: hex(m), metalness: m.metalness, roughness: m.roughness });
const materialsOf = (root: { traverse(cb: (o: unknown) => void): void }) => { const out: MeshStandardMaterial[] = []; root.traverse(o => { if (o instanceof Mesh && o.material instanceof MeshStandardMaterial) out.push(o.material); }); return out; };

test('grade: a Steel material at Recruit is a CLONE carrying the Recruit factors; the shared original is untouched', () => {
  const steel = new MeshStandardMaterial({ name: 'Steel', color: new Color('#c3c7ca'), metalness: .92, roughness: .3 });
  const hook = () => {}; steel.onBeforeCompile = hook;
  const recruit = gradeMaterial(steel, 'Recruit');
  assert.notEqual(recruit, steel, 'a clone: the rig shares this material with his body');
  assert.deepEqual(finish(recruit), GRADES.Recruit.metal);
  assert.deepEqual(finish(steel), { color: '#c3c7ca', metalness: .92, roughness: .3 }, 'the rig\'s own Steel is unchanged');
  assert.equal(recruit.onBeforeCompile, hook, 'the lighting hooks survive the clone');
  assert.equal(gradeMaterial(steel, 'Recruit'), recruit, 'cached per (material, tier): one program per grade');
  const legionary = gradeMaterial(steel, 'Legionary');
  assert.notDeepEqual(finish(legionary), finish(recruit), 'Legionary leather is not Recruit rag & scrap');
  assert.deepEqual(finish(gradeMaterial(new MeshStandardMaterial({ name: 'Leather' }), 'Recruit')), GRADES.Recruit.leather);
  for (const name of ['Bone', 'Ruby', 'Skin', 'Heraldry', 'Gambeson', 'Gambeson_veteran', 'VeteranSurface']) {
    const m = new MeshStandardMaterial({ name });
    assert.equal(gradeMaterial(m, 'Recruit'), m, `${name} keeps its own look: no grade, no clone`);
  }
});

test('grade: the player\'s worn loot is graded by his rank; his own body draws are not', async () => {
  const pieces = lootPiecesOf((await parse('loot.glb')).scene), { player } = buildWarriors(await parse('warrior.glb'));
  const own = materialsOf(player.anchor), ownLook = own.map(finish);
  player.wear(pieces.filter(p => ['veteran.Helmet', 'veteran.Body'].includes(lootId(p))), 'Recruit');
  const worn = player.worn() as SkinnedMesh[], steel = worn.find(p => (p.material as MeshStandardMaterial).name === 'Steel');
  assert.ok(steel, 'the Veteran\'s tunic carries a Steel draw');
  assert.deepEqual(finish(steel!.material as MeshStandardMaterial), GRADES.Recruit.metal);
  const cloth = worn.find(p => (p.material as MeshStandardMaterial).name.startsWith('Gambeson'))!, clothSource = pieces.find(p => p.name === cloth.name)!.material;
  assert.equal(cloth.material, clothSource, 'the tunic\'s cloth is the house dye: ungraded, not cloned');
  const source = pieces.find(p => p.name === steel!.name)!.material as MeshStandardMaterial;
  assert.notEqual(steel!.material, source, 'the parsed piece keeps its own material for the next dressing');
  player.wear(pieces.filter(p => lootId(p) === 'veteran.Body'), 'Legionary');
  assert.deepEqual(finish(player.worn().find(p => p.name === steel!.name)!.material as MeshStandardMaterial), GRADES.Legionary.metal);
  const now = materialsOf(player.anchor).filter(m => !player.worn().some(w => w.material === m));
  assert.deepEqual([now, now.map(finish)], [own, ownLook], 'the player\'s own draws keep their very materials and look: only what he wears is graded');
});

test('grade: a palette-built opponent\'s kit takes the fight tier; a creature body with a baked *Surface keeps its authored look', async () => {
  const warrior = await parse('warrior.glb');
  const { opponent } = buildWarriors(warrior, await parse('goblin.glb'), ['longsword', 'knife']);
  const kept = materialsOf(opponent.anchor).filter(m => ['Bone', 'Skin', 'Heraldry', 'Gambeson'].includes(m.name));
  opponent.grade('Recruit');
  const goblin = materialsOf(opponent.anchor);
  assert.deepEqual(finish(goblin.find(m => m.name === 'Steel')!), GRADES.Recruit.metal);
  assert.deepEqual(finish(goblin.find(m => m.name === 'Leather')!), GRADES.Recruit.leather);
  assert.deepEqual(goblin.filter(m => ['Bone', 'Skin', 'Heraldry', 'Gambeson'].includes(m.name)), kept, 'bone, skin and cloth keep their very materials');
  assert.ok(kept.length >= 4);
  opponent.grade('Legionary');
  assert.deepEqual(finish(materialsOf(opponent.anchor).find(m => m.name === 'Steel')!), GRADES.Legionary.metal, 'a rank-up regrades him');
  const centurion = buildWarriors(warrior, await parse('veteran.glb'), ['longsword', 'trident']).opponent;
  const before = materialsOf(centurion.anchor);
  centurion.grade('Recruit');
  assert.deepEqual(materialsOf(centurion.anchor), before, 'the Centurion (VeteranSurface) keeps every material, his Bronze included');
});
