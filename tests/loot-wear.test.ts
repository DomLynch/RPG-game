import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Mesh, MeshStandardMaterial, SkinnedMesh, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildWarriors, lootId, lootIds, lootPiecesOf, lootWorn } from '../src/characters.ts';
import { LOOT_IDS, type LootId, isWeaponLoot } from '../src/loot.ts';

// Parse a shipped GLB in Node: geometry, rig and material names; images are dropped (decoding is the browser's), as tests/characters.test.ts does.
async function parse(file: string) {
  const bytes = readFileSync(new URL(`../src/assets/${file}`, import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
const pieces = async () => lootPiecesOf((await parse('loot.glb')).scene);   // the game's own reader, so a shared draw resolves here exactly as it does in a fight
const draws = (root: { traverse(cb: (o: unknown) => void): void }, slot: string) => { const out: Mesh[] = []; root.traverse(o => { if (o instanceof Mesh && o.userData.slot === slot) out.push(o); }); return out; };

test('loot: every piece of loot.glb has an id in src/loot.ts, and the player wears a piece by binding it to his own skeleton beside his body', async () => {
  const all = await pieces(), { player } = buildWarriors(await parse('warrior.glb'));
  // `lootIds`, not `lootId`: a shared draw (brief 14's gloves, `~kit.Gloves`) answers to every opponent id that resolves to it, so the
  // file's pieces are still exactly the armour ids — the sharing is invisible from here, which is the point of the seam.
  assert.deepEqual([...new Set(all.flatMap(lootIds))].sort(), [...LOOT_IDS].filter(id => !isWeaponLoot(id as LootId)).sort(), 'the file\'s draws are the armour ids; a weapon piece is its equip file, not a draw');
  const gloves = all.filter(p => lootWorn(p, ['veteran.Gloves']));
  assert.ok(gloves.length, 'the shared gloves resolve through the file\'s map');
  assert.ok(gloves.every(p => lootWorn(p, ['dwarf.Gloves'])), 'and the same draw answers for every opponent that wears it — one mesh, not six');
  assert.ok(!gloves.some(p => lootWorn(p, ['veteran.Helmet'])), 'a shared draw does not answer for a slot it is not');
  const body = draws(player.anchor, 'Body').find((m): m is SkinnedMesh => m instanceof SkinnedMesh)!;
  player.wear(all.filter(p => ['veteran.Helmet', 'nightborn.Body', 'veteran.Greaves'].includes(lootId(p))));
  const worn = player.worn();
  assert.deepEqual([...new Set(worn.map(lootId))].sort(), ['nightborn.Body', 'veteran.Greaves', 'veteran.Helmet'], 'a piece is every draw of its id (a tunic is linen + leather + brass + steel)');
  for (const piece of worn) {
    assert.equal(piece.skeleton, body.skeleton, `${piece.name} follows the player's bones`);
    assert.equal(piece.parent, body.parent, `${piece.name} hangs where his body does`);
    assert.ok(piece.bindMatrix.equals(body.bindMatrix), `${piece.name} shares his bind`);
    assert.equal(piece.frustumCulled, false); assert.ok(piece.castShadow);
    assert.notEqual(all.find(p => p.name === piece.name), piece, 'a copy: the parsed piece is reusable for the next dressing');
  }
  // A `replace` piece hides his own draws in that slot; an `over` piece (the greaves) hides nothing; a helmet hides hair (none on the hero: nothing to hide).
  for (const draw of draws(player.anchor, 'Body')) if (!worn.includes(draw as SkinnedMesh)) assert.equal(draw.visible, false, `${draw.name}: covered by the Nightborn's body`);
  for (const slot of ['Boots', 'Arms', 'Legs', 'Skin', 'Face']) for (const draw of draws(player.anchor, slot)) assert.equal(draw.visible, true, `${draw.name}: still shown`);
  // The bind is live: a helmet vertex moves with the Head bone.
  const helmet = worn.find(p => lootId(p) === 'veteran.Helmet')!, head = body.skeleton.bones.find(b => b.name === 'Head')!;
  player.anchor.updateMatrixWorld(true); body.skeleton.update();
  const at = helmet.applyBoneTransform(0, new Vector3());
  head.rotation.y += Math.PI / 2; player.anchor.updateMatrixWorld(true); body.skeleton.update();
  const after = helmet.applyBoneTransform(0, new Vector3());
  assert.ok([at, after].every(v => Number.isFinite(v.x) && v.length() < 3), 'skinned positions are finite and on the body');
  assert.ok(at.distanceTo(after) > 0.01, 'the helmet turns with the head');
  head.rotation.y -= Math.PI / 2;
});

test('loot: a piece takes the player\'s textured material of the same name, dressing again replaces the set, and nothing stays hidden after undressing', async () => {
  const all = await pieces(), { player } = buildWarriors(await parse('warrior.glb'));
  const steel = draws(player.anchor, 'Body').map(m => m.material).find((m): m is MeshStandardMaterial => m instanceof MeshStandardMaterial && m.name === 'Steel')!;
  steel.map = new Texture();   // the browser's loader gives him maps; Node parsed none
  player.wear(all.filter(p => lootId(p) === 'executioner.Helmet'));
  assert.equal(player.worn().length, 1); assert.equal(player.worn()[0]!.material, steel, 'the Executioner\'s steel mask wears the player\'s Steel');
  const bronze = all.find(p => lootId(p) === 'veteran.Helmet')!;
  player.wear([bronze]);
  assert.equal(player.worn().length, 1); assert.equal(player.worn()[0]!.material, bronze.material, 'no Bronze on the player: the piece keeps its own');
  assert.equal(draws(player.anchor, 'Body').filter(d => !player.worn().includes(d as SkinnedMesh)).every(d => d.visible), true, 'the body shows again once no body piece is worn');
  player.wear([]);
  assert.equal(player.worn().length, 0);
  player.anchor.traverse(o => { if (o instanceof Mesh && typeof o.userData.slot === 'string' && o.userData.slot) assert.equal(o.visible, true, `${o.name} restored`); });
});
