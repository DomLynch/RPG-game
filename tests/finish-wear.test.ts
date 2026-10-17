// A named finish row (finish-rows.json) on a worn piece's metal and on the weapon in the hand (starter items' own look, worn-finish.ts): `wear(..., finishOf)` and `grade(tier, finish)`.
// With the argument absent the output is what it was: the same materials, objects and all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Mesh, MeshStandardMaterial, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildWarriors, lootId, lootPiecesOf } from '../src/fight/characters.ts';
import { finishedAs } from '../src/fight/rank-tint.ts';

async function parse(file: string) {   // a shipped GLB in Node, as tests/grade-materials.test.ts does: geometry, rig and material names; images are the browser's
  const bytes = readFileSync(new URL(`../src/assets/${file}`, import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
const IDS = ['goblin.Helmet', 'goblin.Greaves'];
const rig = async () => { const pieces = lootPiecesOf((await parse('loot.glb')).scene).filter((p) => IDS.includes(lootId(p))); return { pieces, player: buildWarriors(await parse('warrior.glb')).player }; };
const worn = (player: ReturnType<typeof buildWarriors>['player']) => (player.worn() as SkinnedMesh[]).map((p) => [p.name, p.material] as const);
const metalOf = (root: { traverse(cb: (o: unknown) => void): void }) => { const out: [Mesh, unknown][] = []; root.traverse((o) => { if (o instanceof Mesh) out.push([o, o.material]); }); return out; };

test('wear: finishOf absent, or answering undefined, leaves every worn material exactly as it was', async () => {
  const { pieces, player } = await rig();
  player.wear(pieces); const plain = worn(player);
  player.wear(pieces, undefined, undefined, undefined); assert.deepEqual(worn(player), plain, 'the argument absent: the same materials');
  player.wear(pieces, undefined, () => undefined, () => undefined); assert.deepEqual(worn(player), plain, 'an answer of undefined: the same materials');
  assert.equal(plain.length, pieces.length);
});

test('wear: a finish row lands on the metal of the piece it is named for and on no other', async () => {
  const { pieces, player } = await rig();
  player.wear(pieces); const plain = new Map(worn(player));
  player.wear(pieces, undefined, undefined, (piece) => (lootId(piece) === 'goblin.Helmet' ? 'rust' : undefined));
  const after = new Map(worn(player));
  const helmet = pieces.find((p) => lootId(p) === 'goblin.Helmet')!, greaves = pieces.find((p) => lootId(p) === 'goblin.Greaves')!;
  assert.equal(after.get(greaves.name), plain.get(greaves.name), 'the other piece is untouched');
  const before = plain.get(helmet.name) as MeshStandardMaterial, rusted = after.get(helmet.name) as MeshStandardMaterial;
  assert.notEqual(rusted, before, 'the helmet took a finished clone');
  assert.equal(rusted, finishedAs(before, 'rust'), 'the same shared material the ground view would use');
});

test('grade: finish absent is the rung\'s own result; a finish takes the weapon\'s metal over the rung and ungrading gives its own back', async () => {
  const { player } = await rig();
  const own = metalOf(player.anchor);
  player.grade('Legionary'); const graded = metalOf(player.anchor);
  player.grade('Legionary', undefined); assert.deepEqual(metalOf(player.anchor), graded, 'finish absent: the same materials as the rung gave');
  player.grade(undefined, 'rust'); const rusted = metalOf(player.anchor);
  assert.ok(rusted.some(([, m], i) => m !== own[i]![1]), 'at least one weapon draw took the rust finish');
  assert.ok(rusted.some(([, m], i) => m !== graded[i]![1]), 'and it is not the rung\'s tint');
  player.grade(undefined); assert.deepEqual(metalOf(player.anchor), own, 'ungraded: his own materials back');
});
