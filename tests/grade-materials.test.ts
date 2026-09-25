import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Box3, Color, Mesh, MeshStandardMaterial, SkinnedMesh, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildWarriors, gradeMaterial, lootId, lootPiecesOf, lootWorn } from '../src/characters.ts';
import { GRADES, gradeFor } from '../src/grades.ts';
import { LOOT, cleanProvenance, isWeaponLoot, kitWorn, takenTier, type Loot } from '../src/loot.ts';
import { OPPONENTS, WEAPONS, type OpponentId } from '../src/moves.ts';
import { ROSTER } from '../src/roster.ts';
import { splitLoot } from '../scripts/split-loot.mjs';
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
  const hide = new MeshStandardMaterial({ name: 'Leather' }); hide.map = new Texture();
  assert.equal(gradeMaterial(hide, 'Gladiator').map, null, 'graded leather drops its dark colour map, so a light hide can read');
  assert.ok(hide.map, 'the rig\'s own leather keeps its map');
  const plate = new MeshStandardMaterial({ name: 'Steel' }); plate.map = new Texture();
  assert.equal(gradeMaterial(plate, 'Gladiator').map, plate.map, 'metal keeps its map');
  for (const name of ['Bone', 'Ruby', 'Skin', 'Heraldry', 'Gambeson', 'Gambeson_veteran', 'VeteranSurface']) {
    const m = new MeshStandardMaterial({ name });
    assert.equal(gradeMaterial(m, 'Recruit'), m, `${name} keeps its own look: no grade, no clone`);
  }
});

test('grade: the player\'s worn loot is graded; of his own draws only the straps over a worn tunic follow it, and come back when it is off', async () => {
  const pieces = lootPiecesOf((await parse('loot.glb')).scene), { player } = buildWarriors(await parse('warrior.glb'));
  const own = materialsOf(player.anchor), ownLook = own.map(finish), ownNames: string[] = []; player.anchor.traverse(o => { if (o instanceof Mesh && o.material instanceof MeshStandardMaterial) ownNames.push(o.name); });
  player.wear(pieces.filter(p => ['veteran.Helmet', 'veteran.Body'].includes(lootId(p))), undefined, 'Recruit');
  const worn = player.worn() as SkinnedMesh[], steel = worn.find(p => (p.material as MeshStandardMaterial).name === 'Steel');
  assert.ok(steel, 'the Veteran\'s tunic carries a Steel draw');
  assert.deepEqual(finish(steel!.material as MeshStandardMaterial), GRADES.Recruit.metal);
  const cloth = worn.find(p => (p.material as MeshStandardMaterial).name.startsWith('Gambeson'))!, clothSource = pieces.find(p => p.name === cloth.name)!.material;
  assert.equal(cloth.material, clothSource, 'the tunic\'s cloth is the house dye: ungraded, not cloned');
  const source = pieces.find(p => p.name === steel!.name)!.material as MeshStandardMaterial;
  assert.notEqual(steel!.material, source, 'the parsed piece keeps its own material for the next dressing');
  player.wear(pieces.filter(p => lootId(p) === 'veteran.Body'), undefined, 'Legionary');
  assert.deepEqual(finish(player.worn().find(p => p.name === steel!.name)!.material as MeshStandardMaterial), GRADES.Legionary.metal);
  // His own unslotted straps and buckles (the baldric and belt over the chest) take the worn Body piece's grade — the one exception, so the
  // taken tunic reads its rung (Strategy, #705). Every other draw of his keeps its very material and look.
  const strap = (m: MeshStandardMaterial) => ['Leather', 'Antique brass'].includes(m.name);
  let straps: Mesh[] = []; player.anchor.traverse(o => { if (o instanceof SkinnedMesh && !player.worn().includes(o) && !o.userData.slot && o.material instanceof MeshStandardMaterial && strap(o.material)) straps.push(o); });
  assert.ok(straps.length >= 2, 'his baldric and belt');
  for (const o of straps) assert.deepEqual(finish(o.material as MeshStandardMaterial), gradeFor('Legionary', (o.material as MeshStandardMaterial).name), `${o.name}: his strap wears the tunic's Legionary grade`);
  const now = materialsOf(player.anchor).filter(m => !player.worn().some(w => w.material === m) && !straps.some(o => o.material === m));
  const kept = own.filter((m, i) => !(strap(m) && straps.some(o => o.name === ownNames[i])));
  assert.deepEqual(now.map(finish), kept.map(finish), 'the rest of his own draws keep their look');
  player.wear([]);
  assert.deepEqual([materialsOf(player.anchor), materialsOf(player.anchor).map(finish)], [own, ownLook], 'with the tunic off, every one of his own draws is back on its very material');
});

// Phase L (Strategy, 2026-09-23): the opponent wears his own loot.glb carriers, graded at the fight's tier; his own draws, a creature's
// baked *Surface included, keep their very materials. Every opponent that offers armour is dressed, so none can throw on the way in.
const carriersOf = (id: string) => (LOOT[id as OpponentId] ?? []).filter(l => !isWeaponLoot(l));
const cut = async (id: string) => lootPiecesOf((await parse(`loot/carriers-${id}.glb`)).scene);
test('grade: an opponent wears his own carriers at the fight tier; his body, a baked *Surface included, is never touched', async () => {
  const warrior = await parse('warrior.glb'), pieces = [...await cut('executioner'), ...await cut('goblin')];
  const executioner = buildWarriors(warrior, await parse('executioner.glb'), ['longsword', 'scythe']).opponent;
  const own = materialsOf(executioner.anchor), ownLook = own.map(finish);
  assert.ok(own.some(m => m.name === 'ExecutionerSurface'), 'the Executioner is a creature body');
  executioner.wear(pieces.filter(p => lootWorn(p, carriersOf('executioner'))), undefined, 'Recruit');
  const carried = executioner.worn() as SkinnedMesh[], graded = carried.filter(gradeable);
  assert.ok(graded.length, 'the Executioner carries gradeable pieces');
  for (const p of graded) assert.deepEqual(finish(mat(p)), gradeFor('Recruit', mat(p).name), `${p.name} wears the Recruit grade`);
  const recruit = graded.map(p => finish(mat(p)));
  executioner.wear(pieces.filter(p => lootWorn(p, carriersOf('executioner'))), undefined, 'Legionary');
  assert.notDeepEqual((executioner.worn() as SkinnedMesh[]).filter(gradeable).map(p => finish(mat(p))), recruit, 'Legionary leather is not Recruit rag & scrap');
  const body = materialsOf(executioner.anchor).filter(m => !executioner.worn().some(w => w.material === m));
  assert.deepEqual([body, body.map(finish)], [own, ownLook], 'his own draws keep their very materials and look, the ExecutionerSurface included');
  const goblin = buildWarriors(warrior, await parse('goblin.glb'), ['longsword', 'knife']).opponent, goblinOwn = materialsOf(goblin.anchor);
  goblin.wear(pieces.filter(p => lootWorn(p, carriersOf('goblin'))), undefined, 'Recruit');
  assert.deepEqual(materialsOf(goblin.anchor).filter(m => !goblin.worn().some(w => w.material === m)), goblinOwn, 'a palette-built body is not graded either: only what he wears');
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
    opponent.wear(pieces.filter(p => lootWorn(p, ids)), undefined, 'Legionary');
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

// Block A tier dressing (Lead, 2026-09-24): the player's pieces are graded EACH at the tier it was taken at (Provenance.tier), cloth stays the
// house dye, and a piece taken before the field existed shows at Recruit. Display only: nothing here reads or writes a stat.
test('grade: each worn piece takes its own taken tier; the cloth under it is the house dye at every tier', async () => {
  const pieces = lootPiecesOf((await parse('loot.glb')).scene), { player } = buildWarriors(await parse('warrior.glb'));
  const at = { 'veteran.Helmet': 'Gladiator', 'veteran.Body': 'Recruit' } as const;
  player.wear(pieces.filter(p => lootId(p) in at), undefined, p => at[lootId(p) as keyof typeof at]);
  const worn = player.worn() as SkinnedMesh[], of = (id: string) => worn.filter(p => lootId(p) === id);
  const helmet = of('veteran.Helmet').filter(gradeable), body = of('veteran.Body').filter(gradeable);
  assert.ok(helmet.length && body.length, 'both pieces carry gradeable draws');
  for (const p of helmet) assert.deepEqual(finish(mat(p)), gradeFor('Gladiator', mat(p).name), `${p.name}: its own Gladiator grade`);
  for (const p of body) assert.deepEqual(finish(mat(p)), gradeFor('Recruit', mat(p).name), `${p.name}: its own Recruit grade`);
  const cloth = worn.filter(p => /^(Gambeson|Heraldry)/.test(mat(p).name));
  assert.ok(cloth.length, 'the tunic carries its cloth');
  for (const p of cloth) assert.equal(p.material, pieces.find(q => q.name === p.name)!.material, `${p.name}: the house dye, ungraded and not cloned`);
});
test('provenance: the taken tier is a level 1..10, display only; missing or out of range reads as Recruit', () => {
  const kill = { opponent: 'veteran', attempt: 1, healthLeft: 40, recordId: null, day: '2026-09-24' } as const;
  assert.equal(cleanProvenance({ ...kill, tier: 3 })?.tier, 3);
  for (const bad of [0, 11, 2.5, '3', null]) assert.equal(cleanProvenance({ ...kill, tier: bad })?.tier, undefined, `tier ${String(bad)} is dropped, the kill kept`);
  assert.equal(cleanProvenance({ ...kill, tier: 0 })?.opponent, 'veteran');
  const loot: Loot = { owned: ['veteran.Helmet', 'veteran.Body'], equipped: {}, taken: { 'veteran.Helmet': { ...kill, tier: 3 }, 'veteran.Body': { ...kill } } };
  assert.equal(takenTier(loot, 'veteran.Helmet'), 'Gladiator');
  assert.equal(takenTier(loot, 'veteran.Body'), 'Recruit', 'a piece taken before the field existed shows at Recruit');
  assert.equal(takenTier(undefined, 'veteran.Body'), 'Recruit');
});
test('kit: an opponent is dressed in his armour, never his weapon, and a two-hander leaves the shield off (back-stow is not built)', () => {
  assert.deepEqual(kitWorn('veteran', true), LOOT.veteran!.filter(id => !isWeaponLoot(id) && id !== 'veteran.Shield'), 'the Centurion\'s trident takes two hands: no scutum across the haft');
  assert.ok(kitWorn('veteran', false).includes('veteran.Shield'), 'a one-hander brings the shield up, as authored');
  const dwarf = kitWorn('dwarf', true);
  assert.ok(!dwarf.includes('dwarf.Greaves') && !dwarf.includes('dwarf.Boots'), 'the Dwarf wears no Greaves (player-shin shells float) and no Boots (cut from his own scan: z-fight)');
  assert.ok(dwarf.includes('dwarf.Body') && dwarf.includes('dwarf.Gloves'), 'the rest of his kit is still worn');
  assert.ok(LOOT.dwarf!.includes('dwarf.Greaves') && LOOT.dwarf!.includes('dwarf.Boots'), 'presentation only: both are still his loot to award');
  for (const id of Object.keys(LOOT) as OpponentId[]) {
    const twoHanded = WEAPONS[OPPONENTS[id].weapon].grip === 'two-hand';
    assert.ok(kitWorn(id, twoHanded).every(l => !isWeaponLoot(l)), `${id}: no weapon draw`);
  }
});
// Strategy (2026-09-24, #705 NOT YET): Recruit and Legionary were the same Centurion at 375. Adjacent low rungs must differ in more than hue —
// in lightness AND shine — and a Recruit wears no crest. The body's straps (leather) carry the rung too, so a taken tunic reads its tier.
test('grade: Recruit and Legionary differ in lightness and shine, not just hue; a Recruit wears no crest', () => {
  const lum = (hex: string) => { const c = new Color(hex); return .2126 * c.r + .7152 * c.g + .0722 * c.b; };   // linear, as the renderer sees it
  for (const group of ['metal', 'leather'] as const) {   // the big surfaces: plate and straps
    const r = GRADES.Recruit[group], l = GRADES.Legionary[group], g = GRADES.Gladiator[group];
    assert.ok(Math.max(lum(r.color), lum(l.color)) > 2 * Math.min(lum(r.color), lum(l.color)), `${group}: Recruit ${r.color} and Legionary ${l.color} differ in lightness by 2x or more`);
    assert.ok(Math.max(lum(g.color), lum(l.color)) > 2 * Math.min(lum(g.color), lum(l.color)), `${group}: Legionary ${l.color} and Gladiator ${g.color} differ in lightness by 2x or more`);
  }
  assert.ok(Math.abs(GRADES.Recruit.metal.roughness - GRADES.Legionary.metal.roughness) >= .3, 'rust is matte, blackened iron has a sheen');
  assert.ok(GRADES.Legionary.trim.metalness - GRADES.Recruit.trim.metalness >= .5, 'the studs: dead scrap at Recruit, bright brass at Legionary');
  assert.ok(!kitWorn('veteran', true, 'Recruit').includes('veteran.Crest'), 'no plume on a Recruit');
  assert.ok(kitWorn('veteran', true, 'Legionary').includes('veteran.Crest'), 'the plume from Legionary up');
});
