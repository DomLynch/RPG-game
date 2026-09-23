import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Color, Mesh, MeshStandardMaterial, type SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildWarriors, gradeMaterial, lootId, lootPiecesOf, lootWorn } from '../src/characters.ts';
import { GRADES, gradeFor } from '../src/grades.ts';
import { LOOT, isWeaponLoot } from '../src/loot.ts';
import { OPPONENTS, type OpponentId } from '../src/moves.ts';
import { ROSTER } from '../src/roster.ts';
const mat = (p: SkinnedMesh) => p.material as MeshStandardMaterial, gradeable = (p: SkinnedMesh) => !!gradeFor('Recruit', mat(p).name);

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

// Phase L (Strategy, 2026-09-23): the opponent wears his own loot.glb carriers, graded at the fight's tier; his own draws, a creature's
// baked *Surface included, keep their very materials. Every opponent that offers armour is dressed, so none can throw on the way in.
const carriersOf = (id: string) => (LOOT[id as OpponentId] ?? []).filter(l => !isWeaponLoot(l));
test('grade: an opponent wears his own carriers at the fight tier; his body, a baked *Surface included, is never touched', async () => {
  const warrior = await parse('warrior.glb'), pieces = lootPiecesOf((await parse('loot.glb')).scene);
  const executioner = buildWarriors(warrior, await parse('executioner.glb'), ['longsword', 'scythe']).opponent;
  const own = materialsOf(executioner.anchor), ownLook = own.map(finish);
  assert.ok(own.some(m => m.name === 'ExecutionerSurface'), 'the Executioner is a creature body');
  executioner.wear(pieces.filter(p => lootWorn(p, carriersOf('executioner'))), 'Recruit');
  const carried = executioner.worn() as SkinnedMesh[], graded = carried.filter(gradeable);
  assert.ok(graded.length, 'the Executioner carries gradeable pieces');
  for (const p of graded) assert.deepEqual(finish(mat(p)), gradeFor('Recruit', mat(p).name), `${p.name} wears the Recruit grade`);
  const recruit = graded.map(p => finish(mat(p)));
  executioner.wear(pieces.filter(p => lootWorn(p, carriersOf('executioner'))), 'Legionary');
  assert.notDeepEqual((executioner.worn() as SkinnedMesh[]).filter(gradeable).map(p => finish(mat(p))), recruit, 'Legionary leather is not Recruit rag & scrap');
  const body = materialsOf(executioner.anchor).filter(m => !executioner.worn().some(w => w.material === m));
  assert.deepEqual([body, body.map(finish)], [own, ownLook], 'his own draws keep their very materials and look, the ExecutionerSurface included');
  const goblin = buildWarriors(warrior, await parse('goblin.glb'), ['longsword', 'knife']).opponent, goblinOwn = materialsOf(goblin.anchor);
  goblin.wear(pieces.filter(p => lootWorn(p, carriersOf('goblin'))), 'Recruit');
  assert.deepEqual(materialsOf(goblin.anchor).filter(m => !goblin.worn().some(w => w.material === m)), goblinOwn, 'a palette-built body is not graded either: only what he wears');
});

test('grade: every opponent that offers armour is dressed in all of it, and no rig throws on the way in', async () => {
  const warrior = await parse('warrior.glb'), pieces = lootPiecesOf((await parse('loot.glb')).scene);
  for (const [id, recipe] of Object.entries(ROSTER)) {
    const ids = carriersOf(id); if (!ids.length) continue;
    const weapon = OPPONENTS[id as OpponentId].weapon, opponent = buildWarriors(warrior, await parse(`${recipe.body}.glb`), ['longsword', weapon]).opponent;
    opponent.wear(pieces.filter(p => lootWorn(p, ids)), 'Legionary');
    const on = new Set((opponent.worn() as SkinnedMesh[]).flatMap(p => (p.userData.ids as string[] | undefined) ?? [lootId(p)]));
    assert.deepEqual(ids.filter(l => !on.has(l)), [], `${id} wears every armour piece he offers`);
  }
});
