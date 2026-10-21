import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { RANGED_MODELS, rangedModelOf, rangedModelUrl } from '../src/fight/ranged-model-rows.ts';
import { rangedGroundPartOf, rangedPartOf } from '../src/fight/ranged-model.ts';
import { groundLook } from '../origins/preview/ground-looks.ts';
import { missileOf } from '../src/fight/sandbox-rules.ts';
import { WEAPONS } from '../src/fight/moves.ts';

// The painted bow (CS23). The file ships byte for byte as the sandbox's (public/weapons/ranged/PROVENANCE.txt); a swapped file changes this pin and its provenance line.
// The orb staff (2026-10-20, Dom: "a cool staff with a white glowing tip"): the sandbox's procedural staff-v1 (build-ranged-weapons.mjs, Characters & Art 47c653222), baked to glb by that script.
const SHA: Record<string, string> = { 'weapons/ranged/bow-v1.glb': 'ff14366e9a62fcfd43a309f797806480aeedc6ef01158bf2d6d76ba4f0967b94', 'weapons/ranged/staff-v1.glb': 'aaadfdbb7159314af6547f85c6fe486aab058f9d493ee67a770132403ffd3ea0' };
const glbJson = (file: string) => { const b = readFileSync(new URL(`../public/${file}`, import.meta.url)); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()) as { nodes: { name: string; extras?: { hand?: string; weapon?: string } }[] }; };

test('the shipped ranged model files are the pinned ones, and the provenance names each', () => {
  const provenance = readFileSync(new URL('../public/weapons/ranged/PROVENANCE.txt', import.meta.url), 'utf8');
  for (const [file, sha] of Object.entries(SHA)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(`../public/${file}`, import.meta.url))).digest('hex'), sha, `${file} is the sandbox's pinned file`);
    assert.ok(provenance.includes(sha) && provenance.includes(file.split('/').pop()!), `${file}: PROVENANCE.txt names the file and its sha256`);
  }
});

test('the ranged model rows: one per shipped file, the model is where the row says, and the row agrees with the model\'s own node', () => {
  assert.deepEqual(RANGED_MODELS.map((m) => m.file).sort(), Object.keys(SHA).sort(), 'a row per pinned file and no row without one');
  for (const m of RANGED_MODELS) {
    assert.ok(existsSync(new URL(`../public/${m.file}`, import.meta.url)), `${m.id}: public/${m.file} exists`);
    assert.equal(rangedModelUrl(m), `/${m.file}`);
    const node = glbJson(m.file).nodes.find((n) => n.name === m.node);
    assert.ok(node, `${m.id}: the file has the node ${m.node}`);
    assert.equal(node!.extras?.hand, m.hand, `${m.id}: the row's hand is the model's own userData.hand`);
    assert.equal(node!.extras?.weapon, `${m.id}-v1`, `${m.id}: the model names its own kind`);
    assert.ok(m.holdDeg.every((d) => Number.isFinite(d) && Math.abs(d) <= 180), `${m.id}: the hold is three angles in degrees`);
    assert.ok(m.metalness >= 0 && m.metalness <= 1 && m.roughness >= 0 && m.roughness <= 1, `${m.id}: the matte is a pair of 0-1 values`);
  }
});

test('the bow and the staff are the ranged models: the crossbow was dropped by Dom (CS22) and a kind with no row keeps what the game draws', () => {
  assert.deepEqual(RANGED_MODELS.map((m) => m.id), ['bow', 'staff']);
  assert.deepEqual(rangedModelOf('bow')?.holdDeg, [-1.9, 34.6, 114.3], 'the sandbox\'s own hold');
  assert.deepEqual(rangedModelOf('staff')?.holdDeg, [90, 0, 0], 'the sandbox\'s staff hold (scripts/weapon-stage/holds.json)');
  assert.deepEqual(rangedModelOf('staff')?.holdPos, [0, 0.08, 0.015], 'it points out from the fist like the maul and trident: SwordDrawn\'s offset');
  assert.equal(rangedModelOf('crossbow'), undefined);
});

test('the staff model: a tall staff whose orb is emissive and whose contact segment runs up the head (the bolt and the swing read it)', () => {
  const file = readFileSync(new URL('../public/weapons/ranged/staff-v1.glb', import.meta.url)), json = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString()) as { nodes: { name: string; extras?: { contact?: { from: number; to: number }; muzzle?: number[] } }[]; materials: { name: string; emissiveFactor?: number[] }[] };
  const node = json.nodes.find((n) => n.name === 'WeaponDrawn')!;
  assert.deepEqual(node.extras?.contact, { from: 1, to: 1.45 });
  assert.deepEqual(node.extras?.muzzle, [0, 1.36, 0], 'the orb in its cradle');
  assert.ok(json.materials.some((m) => m.emissiveFactor?.some((v) => v > 0)), 'the orb glows (an emissive material)');
});

// The loader's pure half (rangedPartOf) on a synthetic scene, and the dormant guarantee: no game weapon reaches a model row.
test('rangedPartOf: the row\'s node becomes the equip part (named WeaponDrawn, its hand, the row\'s hold, a matte COPY of the material); a file without the node is refused', () => {
  const bow = rangedModelOf('bow')!, scene = new Group(), node = new Group(), mat = new MeshStandardMaterial({ metalness: 1, roughness: 1 });
  node.name = bow.node; node.add(new Mesh(new BoxGeometry(), mat)); scene.add(node);
  const part = rangedPartOf(scene, bow);
  assert.equal(part.name, 'WeaponDrawn');
  assert.equal(part.userData.hand, bow.hand);
  assert.equal(part.userData.rangedModel, 'bow', 'reshape reads this and leaves the node be');
  assert.deepEqual([part.rotation.x, part.rotation.y, part.rotation.z].map((r) => Math.round((r * 180) / Math.PI * 10) / 10), [...bow.holdDeg]);
  const m = (part.children[0] as Mesh).material as MeshStandardMaterial;
  assert.deepEqual([m.metalness, m.roughness], [bow.metalness, bow.roughness]);
  assert.deepEqual([mat.metalness, mat.roughness], [1, 1], 'the loaded file\'s own material is untouched');
  assert.throws(() => rangedPartOf(new Group(), bow), /no node WeaponDrawn/);
  // the hold's offset, and a procedural model's own materials left alone (only the TRELLIS 1 / 1 signature is matted)
  const staff = rangedModelOf('staff')!, ssc = new Group(), snode = new Group(), brass = new MeshStandardMaterial({ metalness: 0.85, roughness: 0.45 });
  snode.name = staff.node; snode.add(new Mesh(new BoxGeometry(), brass)); ssc.add(snode);
  const spart = rangedPartOf(ssc, staff);
  assert.deepEqual([spart.position.x, spart.position.y, spart.position.z], [0, 0.08, 0.015]);
  const sm = (spart.children[0] as Mesh).material as MeshStandardMaterial;
  assert.deepEqual([sm.metalness, sm.roughness], [0.85, 0.45], 'the brass keeps its own metalness and roughness');
});

test('bound (2026-10-19, Dom: the bow and the staff are real weapons; 2026-10-20 the orb staff): exactly the "bow" and "staff" weapons are bound to a missile kind that has a model row; every other weapon keeps what the game draws', () => {
  const bound = Object.keys(WEAPONS).filter((id) => rangedModelOf(missileOf(id)?.kind ?? '') !== undefined);
  assert.deepEqual(bound, ['bow', 'staff'], 'the missile rows bind the bow to the painted bow and the staff to the orb staff, and nothing else');
});

// The bow lying on the ground (the Pit's ground-item view): the equip file player/bow.glb is a byte copy of knife.glb, so the starter bow drew as a knife until the ground row's asset named the ranged model.
test('rangedGroundPartOf: the ground bow is the matte painted model with no hand hold, and the starter bow row names it with no iron finish over its paint', () => {
  const bow = rangedModelOf('bow')!, scene = new Group(), node = new Group(), mat = new MeshStandardMaterial({ metalness: 1, roughness: 1 });
  node.name = bow.node; node.add(new Mesh(new BoxGeometry(), mat)); scene.add(node);
  const lying = rangedGroundPartOf(scene, bow), part = lying.getObjectByName('WeaponDrawn')!;
  assert.ok(part, 'the ground view finds the WeaponDrawn node in it');
  assert.deepEqual([part.rotation.x, part.rotation.y, part.rotation.z], [0, 0, 0], 'the hand hold is not carried to the ground');
  const m = (part.children[0] as Mesh).material as MeshStandardMaterial;
  assert.deepEqual([m.metalness, m.roughness], [bow.metalness, bow.roughness]);
  assert.deepEqual([mat.metalness, mat.roughness], [1, 1], 'the loaded file\'s own material is untouched');
  const row = groundLook('item:starter.bow');
  assert.ok(rangedModelOf(row.asset), 'the starter bow row names a ranged model, not an equip file');
  assert.equal(row.finish, undefined, 'no finish: an iron finish would grey the painted wood');
});
