import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Box3, Mesh, MeshStandardMaterial, SkinnedMesh, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SOURCE_MAPPED, buildWarriors, lootId, lootPiecesOf, lootWorn } from '../src/characters.ts';
import { LOOT, cleanProvenance, isWeaponLoot, kitWorn } from '../src/loot.ts';
import { OPPONENTS, WEAPONS, type OpponentId } from '../src/moves.ts';
import { ROSTER } from '../src/roster.ts';
import { splitLoot } from '../scripts/split-loot.mjs';
const mat = (p: SkinnedMesh) => p.material as MeshStandardMaterial;

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

// Strategy's ruling C (#705, 2026-09-25): nothing is graded. A worn piece keeps its source opponent's material, at every rung, on every wearer.
test('ruling C: the player\'s worn pieces are never graded: each wears its own material or his same-named one, and his own draws are untouched', async () => {
  const pieces = lootPiecesOf((await parse('loot.glb')).scene), { player } = buildWarriors(await parse('warrior.glb'));
  const own = materialsOf(player.anchor), ownLook = own.map(finish), mine = new Map(own.map(m => [m.name, m]));
  player.wear(pieces.filter(p => ['veteran.Helmet', 'veteran.Body', 'knight.Body'].includes(lootId(p))));
  const worn = player.worn() as SkinnedMesh[];
  assert.ok(worn.length >= 3, 'the three pieces are on');
  for (const p of worn) {
    const source = mat(pieces.find(q => q.name === p.name)!);
    assert.ok(p.material === source || p.material === mine.get(source.name), `${p.name}: its own material or his ${source.name}, never a graded clone`);
  }
  assert.deepEqual([materialsOf(player.anchor).filter(m => !worn.some(w => w.material === m)), own.map(finish)], [own, ownLook], 'his own draws keep their very materials and look');
  player.wear([]);
  assert.deepEqual(materialsOf(player.anchor), own);
});

// Phase L (Strategy, 2026-09-23): the opponent wears his own loot.glb carriers, ungraded (ruling C); his own draws, a creature's baked
// *Surface included, keep their very materials. Every opponent that offers armour is dressed, so none can throw on the way in.
const carriersOf = (id: string) => (LOOT[id as OpponentId] ?? []).filter(l => !isWeaponLoot(l));
const cut = async (id: string) => lootPiecesOf((await parse(`loot/carriers-${id}.glb`)).scene);
test('ruling C: an opponent wears his own carriers ungraded; his body, a baked *Surface included, is never touched', async () => {
  const warrior = await parse('warrior.glb'), pieces = [...await cut('executioner'), ...await cut('goblin')];
  const rig = await parse('executioner.glb');
  rig.scene.traverse(o => { if (o instanceof Mesh && o.material instanceof MeshStandardMaterial && SOURCE_MAPPED.executioner!.includes(o.material.name)) o.material.map = new Texture(); });   // parse() drops images
  const executioner = buildWarriors(warrior, rig, ['longsword', 'scythe']).opponent;
  const own = materialsOf(executioner.anchor), ownLook = own.map(finish), his = new Map(own.map(m => [m.name, m]));
  assert.ok(own.some(m => m.name === 'ExecutionerSurface'), 'the Executioner is a creature body');
  executioner.wear(pieces.filter(p => lootWorn(p, carriersOf('executioner'))));
  const carried = executioner.worn() as SkinnedMesh[];
  assert.ok(carried.length, 'the Executioner is dressed');
  for (const p of carried.filter(p => p.userData.slot !== 'Shield')) {   // a shield wears a two-sided copy of the same material (bothSides)
    // the piece it was copied from (a shared ~kit draw repeats its name), mapped by its own source rig, as wear() does
    const source = mat(pieces.find(q => q.geometry === p.geometry)!), expected = SOURCE_MAPPED[p.userData.opponent as OpponentId]?.includes(source.name) ? his.get(source.name) ?? source : source;
    assert.equal(p.material, expected, `${p.name}: the carrier's own material (or his own mapped one), never a graded clone`);
  }
  const body: MeshStandardMaterial[] = [];   // his own draws, by mesh: a worn piece may share his very (mapped) material
  executioner.anchor.traverse(o => { if (o instanceof Mesh && o.material instanceof MeshStandardMaterial && !carried.includes(o as SkinnedMesh)) body.push(o.material); });
  assert.deepEqual([body, body.map(finish)], [own, ownLook], 'his own draws keep their very materials and look, the ExecutionerSurface included');
  const goblin = buildWarriors(warrior, await parse('goblin.glb'), ['longsword', 'knife']).opponent, goblinOwn = materialsOf(goblin.anchor);
  goblin.wear(pieces.filter(p => lootWorn(p, carriersOf('goblin'))));
  assert.deepEqual(materialsOf(goblin.anchor).filter(m => !goblin.worn().some(w => w.material === m)), goblinOwn, 'a palette-built body is untouched too');
});

test('grade: every opponent that offers armour is dressed in all of it from his own cut, and no rig throws on the way in', async () => {
  const warrior = await parse('warrior.glb'), whole = readFileSync(new URL('../src/assets/loot.glb', import.meta.url));
  for (const [id, recipe] of Object.entries(ROSTER)) {
    const ids = carriersOf(id), file = new URL(`../src/assets/loot/carriers-${id}.glb`, import.meta.url);
    if (!ids.length) { assert.ok(!existsSync(file), `${id} offers no armour, so he has no cut`); continue; }
    assert.ok(splitLoot(whole, ids).equals(readFileSync(file)), `carriers-${id}.glb is loot.glb's cut: run node scripts/split-loot.mjs`);
    const pieces = await cut(id);
    assert.deepEqual(pieces.filter(p => !lootWorn(p, ids)).map(lootId), [], `${id}'s cut carries nobody else's kit`);
    const weapon = OPPONENTS[id as OpponentId].weapon, opponent = buildWarriors(warrior, await parse(`${recipe.body}.glb`), ['longsword', weapon]).opponent;
    opponent.wear(pieces.filter(p => lootWorn(p, ids)));
    const on = new Set((opponent.worn() as SkinnedMesh[]).flatMap(p => (p.userData.ids as string[] | undefined) ?? [lootId(p)]));
    assert.deepEqual(ids.filter(l => !on.has(l)), [], `${id} wears every armour piece he offers`);
    // Every piece is authored on the hero's bind pose and must follow THIS rig's joints: bound with the rig's own inverse binds, the
    // Dwarf's gloves hung ~.27 m above his head (Phase L still, 2026-09-23). No piece may reach past the body it is worn on.
    opponent.anchor.updateMatrixWorld(true);
    const body = new Box3(); opponent.anchor.traverse(o => { if (o instanceof SkinnedMesh && !opponent.worn().includes(o) && o.visible) { o.computeBoundingBox(); body.union(o.boundingBox!.clone().applyMatrix4(o.matrixWorld)); } });
    for (const p of opponent.worn() as SkinnedMesh[]) {
      p.computeBoundingBox(); const box = p.boundingBox!.clone().applyMatrix4(p.matrixWorld);
      const above = ['Helmet', 'Crest'].includes(String(p.userData.slot)) ? .25 : .05;   // a helmet sits over the skull, a crest stands proud of it
      assert.ok(box.max.y <= body.max.y + above && box.min.y >= body.min.y - .05, `${p.name} stays on ${id}: y ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)} vs body ${body.min.y.toFixed(2)}..${body.max.y.toFixed(2)}`);
    }
  }
});

test('grade: loot.glb is skinned on the hero\'s own bind pose, so binding a piece with its own inverse binds changes nothing on the player', async () => {
  const pieces = lootPiecesOf((await parse('loot.glb')).scene), { player } = buildWarriors(await parse('warrior.glb'));
  let body: SkinnedMesh | undefined; player.anchor.traverse(o => { if (o instanceof SkinnedMesh && o.userData.slot === 'Body' && !body) body = o; });
  for (const piece of pieces) assert.ok(piece.skeleton.boneInverses.every((m, i) => m.equals(body!.skeleton.boneInverses[i])), `${piece.name}: the hero's inverse binds`);
});

test('provenance: the taken tier is recorded as a level 1..10; anything else is dropped and the kill kept', () => {
  const kill = { opponent: 'veteran', attempt: 1, healthLeft: 40, recordId: null, day: '2026-09-24' } as const;
  assert.equal(cleanProvenance({ ...kill, tier: 3 })?.tier, 3);
  for (const bad of [0, 11, 2.5, '3', null]) assert.equal(cleanProvenance({ ...kill, tier: bad })?.tier, undefined, `tier ${String(bad)} is dropped, the kill kept`);
  assert.equal(cleanProvenance({ ...kill, tier: 0 })?.opponent, 'veteran');
});
test('kit: an opponent is dressed in his armour, never his weapon, and a two-hander leaves the shield off (back-stow is not built)', () => {
  assert.deepEqual(kitWorn('veteran', true), LOOT.veteran!.filter(id => !isWeaponLoot(id) && id !== 'veteran.Shield'), 'the Centurion\'s trident takes two hands: no scutum across the haft');
  assert.ok(kitWorn('veteran', false).includes('veteran.Shield'), 'a one-hander brings the shield up, as authored');
  const dwarf = kitWorn('dwarf', true);
  assert.ok(!dwarf.includes('dwarf.Greaves') && !dwarf.includes('dwarf.Boots'), 'the Dwarf wears no Greaves (player-shin shells float) and no Boots (cut from his own scan: z-fight)');
  assert.ok(dwarf.includes('dwarf.Body') && dwarf.includes('dwarf.Gloves'), 'the rest of his kit is still worn');
  assert.ok(LOOT.dwarf!.includes('dwarf.Greaves') && LOOT.dwarf!.includes('dwarf.Boots'), 'presentation only: both are still his loot to award');
  const doctor = kitWorn('plaguedoctor', false, 'Master');
  assert.ok(!doctor.includes('plaguedoctor.Helmet') && doctor.includes('plaguedoctor.Body'), 'the Plague Doctor fights hatless (the hat\'s sheen read silver against the sun), the rest of his kit worn');
  assert.ok(LOOT.plaguedoctor!.includes('plaguedoctor.Helmet'), 'presentation only: the hat is still his loot to award');
  for (const id of Object.keys(LOOT) as OpponentId[]) {
    const twoHanded = WEAPONS[OPPONENTS[id].weapon].grip === 'two-hand';
    assert.ok(kitWorn(id, twoHanded).every(l => !isWeaponLoot(l)), `${id}: no weapon draw`);
  }
});
// Strategy (2026-09-24, #705): a Recruit wears no crest; the plume is the first thing a Legionary earns.
test('kit: a Recruit wears no crest, a Legionary does', () => {
  assert.ok(!kitWorn('veteran', true, 'Recruit').includes('veteran.Crest'), 'no plume on a Recruit');
  assert.ok(kitWorn('veteran', true, 'Legionary').includes('veteran.Crest'), 'the plume from Legionary up');
});
// Strategy's ruling C (#705, 2026-09-25): a worn set keeps the finish it had on the opponent it came from. The Knight's rig maps no KnightIron, so on
// him his six wear the carrier's own KnightIron at their tier; on the hero they must too, not the hero's textured Steel (the flat grey-blue set).
test('ruling C: SOURCE_MAPPED is each rig\'s mapped loot-palette names, read from the shipped GLBs', () => {
  const json = (file: string) => { const b = readFileSync(new URL(`../src/assets/${file}`, import.meta.url)); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()); };
  const palette = new Set((json('loot.glb').materials as { name: string }[]).map(m => m.name));
  for (const id of Object.keys(LOOT) as OpponentId[]) {
    const mapped = (json(`${id}.glb`).materials as { name: string; pbrMetallicRoughness?: { baseColorTexture?: object } }[]).filter(m => m.pbrMetallicRoughness?.baseColorTexture && palette.has(m.name)).map(m => m.name);
    assert.deepEqual([...(SOURCE_MAPPED[id] ?? [])].sort(), mapped.sort(), `${id}: the table matches his rig`);
  }
});
test('ruling C: the Knight\'s iron worn on the hero is the very material the opponent Knight wears; a Goblin piece takes the mapped Steel, ungraded', async () => {
  const pieces = lootPiecesOf((await parse('loot.glb')).scene), warrior = await parse('warrior.glb'), heroSteel = new Texture();
  warrior.scene.traverse(o => { if (o instanceof Mesh && o.material instanceof MeshStandardMaterial && o.material.name === 'Steel') o.material.map = heroSteel; });   // parse() drops images
  const { player, opponent } = buildWarriors(warrior, await parse(`${ROSTER.knight.body}.glb`), ['longsword', OPPONENTS.knight.weapon]);
  const knight = pieces.filter(p => lootId(p).startsWith('knight.') && p.userData.slot !== 'Shield' && mat(p).name === 'KnightIron'), goblin = pieces.find(p => lootId(p) === 'goblin.Body' && mat(p).name === 'Steel')!;
  assert.ok(knight.length && goblin, 'Knight iron and Goblin Steel draws exist');
  const heroLook = finish(mat(goblin)), mapped = materialsOf(player.anchor).find(m => m.name === 'Steel' && m.map === heroSteel)!, mappedLook = finish(mapped);
  player.wear([...knight, goblin]); opponent.wear(knight);
  const on = (who: typeof player, p: SkinnedMesh) => (who.worn() as SkinnedMesh[]).find(w => w.name === p.name)!.material;
  for (const p of knight) {
    assert.equal(on(player, p), on(opponent, p), `${lootId(p)}: the hero wears the very iron the Knight wears`);
    assert.equal(on(player, p), p.material, `${lootId(p)}: the carrier's own KnightIron, not a graded clone`);
    assert.equal((on(player, p) as MeshStandardMaterial).map, null, `${lootId(p)}: not the hero's texture`);
  }
  assert.equal(on(player, goblin), mapped, 'a Goblin piece takes the mapped Steel, as it does on the Goblin');
  assert.deepEqual([finish(mapped), finish(mat(goblin))], [mappedLook, heroLook], 'and nothing is repainted');
});
