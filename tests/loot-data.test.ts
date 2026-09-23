import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { LADDER } from '../src/ladder.ts';
import { ROSTER } from '../src/roster.ts';
import { ARMOUR_SLOTS, LOCKERS, LOOT, LOOT_IDS, PAPERDOLL, WEAPON_SLOTS, cleanLoot, cleanProvenance, dropFor, emptyLoot, isLootId, isWeaponLoot, lootName, mergeLoot, paperdollOf, recordTaken, slotOf, store, subRank, unwear, wear, weaponOf, type LootId } from '../src/loot.ts';
import { WEAPON_CLIPS } from '../src/characters.ts';
import { PLAYER_WEAPONS } from '../src/moves.ts';

type Glb = { scene: number; scenes: { extras?: { pieces?: Record<string, string> } }[]; nodes: { name: string; mesh?: number; extras?: Record<string, string> & { pieces?: Record<string, string> } }[] };
// The shared-draw map the build writes into loot.glb. three's GLTFExporter puts the root Object3D's userData on that object's NODE
// (here the one named 'Scene'), not on the glTF scene, so read both rather than assuming which — the file is the contract, not the
// exporter's current choice.
const sharedPieces = (json: Glb): Record<string, string> =>
  json.scenes[json.scene]?.extras?.pieces ?? json.nodes.find(n => n.extras?.pieces)?.extras?.pieces ?? {};

// The draws of src/assets/loot.glb: `<opponent>.<slot>.<material>` with userData { opponent, slot, layer }. A draw whose name starts
// `~` is SHARED (brief 14): one mesh several opponents wear, and the file's own scene userData maps `<opponent>.<slot>` onto it. The pin
// below means "LOOT lists exactly what the file provides", so a shared draw expands into the opponents that reference it.
function lootDraws(): { id: string; slot: string; opponent: string; layer: string }[] {
  const bytes = readFileSync('src/assets/loot.glb'), length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString()) as Glb;
  const pieces = sharedPieces(json);
  const out: { id: string; slot: string; opponent: string; layer: string }[] = [];
  for (const node of json.nodes.filter(n => n.mesh !== undefined)) {
    const id = node.name.split('.').slice(0, 2).join('.'), slot = node.extras?.slot ?? '', layer = node.extras?.layer ?? '';
    if (!node.name.startsWith('~')) { out.push({ id, slot, opponent: node.extras?.opponent ?? '', layer }); continue; }
    for (const [ref, target] of Object.entries(pieces)) if (target === id) out.push({ id: ref, slot, opponent: ref.split('.')[0], layer });
  }
  return out;
}

test('loot: a shared draw is exported once and every opponent that wears it resolves through the file\'s own map', { skip: !existsSync('src/assets/loot.glb') && 'src/assets/loot.glb is not on this checkout' }, () => {
  const bytes = readFileSync('src/assets/loot.glb'), length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString()) as Glb;
  const pieces = sharedPieces(json), names = new Set(json.nodes.filter(n => n.mesh !== undefined).map(n => n.name));
  assert.ok(Object.keys(pieces).length >= 6, `the map ships in the file: ${JSON.stringify(pieces)}`);
  for (const [ref, target] of Object.entries(pieces)) {
    assert.ok(isLootId(ref), `${ref} is a LootId — sharing is a fact about the file, never about what a player owns`);
    assert.ok([...names].some(n => n.startsWith(`${target}.`)), `${ref} resolves to a draw: ${target}`);
    assert.ok(!names.has(ref), `${ref} must NOT also exist as its own draw — that is the duplication the shared schema removes`);
  }
  // The saving, stated as a fact about this file: one mesh, six wearers.
  const shared = [...names].filter(n => n.startsWith('~'));
  assert.ok(shared.length && shared.length < Object.keys(pieces).length, `${shared.length} shared draws serve ${Object.keys(pieces).length} opponent slots`);
});

test('loot: the armour piece list is exactly the draws of loot.glb, every piece names its opponent and a known slot, and every slot maps to one paperdoll key', { skip: !existsSync('src/assets/loot.glb') && 'src/assets/loot.glb is not on this checkout' }, () => {
  const draws = lootDraws();
  assert.deepEqual([...LOOT_IDS].filter(id => !isWeaponLoot(id as LootId)).sort(), [...new Set(draws.map(d => d.id))].sort(), 'src/loot.ts LOOT must list exactly the file\'s armour pieces (weapons are equip files, not draws)');
  for (const draw of draws) { assert.equal(draw.id, `${draw.opponent}.${draw.slot}`, `${draw.id}: name and userData agree`); assert.ok(['replace', 'over'].includes(draw.layer), `${draw.id}: layer`); assert.ok(paperdollOf(slotOf(draw.id as never)), `${draw.id}: a paperdoll slot`); }
  for (const key of Object.keys(PAPERDOLL)) assert.ok(['head', 'chest', 'arms', 'hands', 'legs', 'feet', 'main', 'off'].includes(key));
  assert.equal(LOCKERS.open, 1); assert.equal(LOCKERS.total, 6);
});

// A takeable weapon (owner via Strategy, 2026-09-22): its id is `<opponent>.<Weapon>`, it fills the main hand, its visual is the weapon's equip
// file (the #309 contract), never a loot.glb draw, and it is the opponent's own weapon.
test('loot: every weapon piece names a player weapon whose equip file ships with its clip family, sits in the main hand, and is its opponent\'s weapon', () => {
  const weapons = [...LOOT_IDS].filter(id => isWeaponLoot(id as LootId)) as LootId[];
  assert.deepEqual(weapons.sort(), ['dwarf.Warhammer', 'executioner.Scythe', 'goblin.Knife', 'knight.Maul', 'nightborn.Estoc', 'pitborn.Cleaver', 'plaguedoctor.Longsword', 'shieldmaiden.Gladius', 'veteran.Trident', 'witch.Trident'], 'every live warden\'s weapon is takeable');
  // Every rung offers its weapon (Strategy, 2026-09-23): the Plague Doctor's longsword included — its equip file is the hero's own
  // SwordDrawn (build-player-weapon.mjs longsword) — and the Shieldmaiden's gladius, which joined ahead of her armour export.
  for (const rung of LADDER) assert.ok(weapons.includes(`${rung.id}.${ROSTER[rung.id].weapon[0]!.toUpperCase()}${ROSTER[rung.id].weapon.slice(1)}` as LootId), `${rung.id}'s weapon is a piece`);
  assert.deepEqual([...new Set(WEAPON_SLOTS)].length, WEAPON_SLOTS.length); assert.ok(WEAPON_SLOTS.every(slot => !(ARMOUR_SLOTS as readonly string[]).includes(slot)));
  assert.deepEqual([...PAPERDOLL.main], [...WEAPON_SLOTS]); assert.deepEqual([...PAPERDOLL.off], ['Shield']);   // the off hand carries the shield (shield spec); weapons fill the main hand
  const swordRoles = new Set(['Idle', 'Walk', 'Jog', 'Run', 'Armed', 'Attack', 'Hit', 'Death', 'Draw', 'Roll', 'Guard', 'Return', 'Heavy', 'Riposte', 'ArmedWalk', 'StrafeLeft', 'StrafeRight', 'Kick', 'BlockImpact', 'Parry', 'Deflected']);
  for (const id of weapons) {
    const weapon = weaponOf(id), opponent = id.split('.')[0];
    assert.ok(PLAYER_WEAPONS.includes(weapon), `${id}: ${weapon} is a player weapon`);
    assert.equal(paperdollOf(slotOf(id)), 'main', `${id} fills the main hand`);
    assert.equal(ROSTER[opponent as keyof typeof ROSTER].weapon, weapon, `${id}: the ${opponent}'s own weapon`);
    const file = `src/assets/weapons/player/${weapon}.glb`;
    assert.ok(existsSync(file), `${id}: ${file} ships`);
    const bytes = readFileSync(file), length = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + length).toString()) as { nodes: { name: string }[]; animations?: { name: string }[] };
    assert.ok(json.nodes.some(n => n.name === 'WeaponDrawn'), `${id}: the equip file carries WeaponDrawn`);
    const clips = new Set((json.animations ?? []).map(a => a.name));
    for (const clip of Object.values(WEAPON_CLIPS[weapon] ?? {})) if (!swordRoles.has(clip)) assert.ok(clips.has(clip), `${id}: the equip file carries ${clip}`);
  }
  assert.throws(() => weaponOf('veteran.Helmet'), /not a weapon piece/);
  assert.equal(lootName('veteran.Trident', 'the Veteran'), 'the Veteran\'s trident');
});

test('loot: one fixed piece per opponent per career sub-rank, never a duplicate, nothing from an opponent without pieces', () => {
  assert.equal(subRank(0), 0); assert.equal(subRank(3), 1); assert.equal(subRank(14), 4); assert.equal(subRank(15), 5); assert.equal(subRank(30), 10); assert.equal(subRank(205), 45); assert.equal(subRank(-4), 0);
  // The Veteran wears six slots (slot order: Helmet, Crest, Body, Arms, Greaves, Boots); the seventh sub-rank comes round to the first.
  assert.equal(dropFor('veteran', 0, []), 'veteran.Helmet'); assert.equal(dropFor('veteran', 3, []), 'veteran.Crest'); assert.equal(dropFor('veteran', 6, []), 'veteran.Body'); assert.equal(dropFor('veteran', 12, []), 'veteran.Greaves'); assert.equal(dropFor('veteran', 18, []), 'veteran.Gloves'); assert.equal(dropFor('veteran', 21, []), 'veteran.Shield'); assert.equal(dropFor('veteran', 24, []), 'veteran.Helmet', 'eight armour pieces, so the ninth sub-rank comes round to the first');
  assert.equal(dropFor('veteran', 24, ['veteran.Helmet']), null, 'a piece already owned never drops twice');
  // The Pitborn's six (Phase R): skullcap, sash, bone plates, shin wraps, foot wraps, the shared gloves — the seventh sub-rank comes round.
  assert.equal(dropFor('pitborn', 0, []), 'pitborn.Helmet'); assert.equal(dropFor('pitborn', 3, []), 'pitborn.Body'); assert.equal(dropFor('pitborn', 6, []), 'pitborn.Arms'); assert.equal(dropFor('pitborn', 15, []), 'pitborn.Gloves'); assert.equal(dropFor('pitborn', 18, []), 'pitborn.Helmet');
  assert.equal(dropFor('pitborn', 18, ['pitborn.Helmet', 'pitborn.Body', 'pitborn.Arms', 'pitborn.Greaves', 'pitborn.Boots', 'pitborn.Gloves']), null, 'and nothing more once all six are owned — his cleaver is taken, never dropped');
  // The Dwarf's five armour drops since the upper re-cut (war-girdle, vambraces, greaves, boots, the shared gloves; no Helmet — his head
  // is scalp and beard), then round again.
  assert.equal(dropFor('dwarf', 0, []), 'dwarf.Body'); assert.equal(dropFor('dwarf', 3, []), 'dwarf.Arms'); assert.equal(dropFor('dwarf', 6, []), 'dwarf.Greaves'); assert.equal(dropFor('dwarf', 9, []), 'dwarf.Boots'); assert.equal(dropFor('dwarf', 12, []), 'dwarf.Gloves', 'girdle, vambraces, greaves, boots (the foot iron, its own slot since Phase R), then the shared gloves'); assert.equal(dropFor('dwarf', 15, []), 'dwarf.Body', 'five armour pieces, so the sixth sub-rank comes round to the first');
  assert.equal(dropFor('goblin', 0, []), 'goblin.Body'); assert.equal(dropFor('goblin', 3, []), 'goblin.Arms'); assert.equal(dropFor('goblin', 6, ['goblin.Body', 'goblin.Arms', 'goblin.Gloves']), null, 'all three Goblin pieces owned: nothing more');
  for (const rung of LADDER) for (let marks = 0; marks < 210; marks += 3) { const id = dropFor(rung.id, marks, []); if (id) assert.ok(isLootId(id) && id.startsWith(`${rung.id}.`) && !isWeaponLoot(id), `${id}: a weapon is taken, never dropped`); }
  // The Veteran's seven pieces are six armour drops and the trident: the drop cycle is the armour's, the trident is left for "Take one".
  assert.equal(LOOT.veteran!.length, 9); assert.equal(dropFor('veteran', 9, []), 'veteran.Arms'); assert.equal(dropFor('veteran', 9, ['veteran.Helmet', 'veteran.Crest', 'veteran.Body', 'veteran.Arms', 'veteran.Greaves', 'veteran.Boots', 'veteran.Gloves', 'veteran.Shield']), null, 'all armour owned: nothing drops, the trident is not a drop');
});

test('loot: a saved record is cleaned — known ids only, no duplicates, worn pieces must be owned and in their own slot; store, wear, unwear and merge lose nothing', () => {
  assert.deepEqual(cleanLoot(null), emptyLoot()); assert.deepEqual(cleanLoot('x'), emptyLoot());
  assert.deepEqual(cleanLoot({ owned: ['veteran.Helmet', 'veteran.Helmet', 'goblin.Wings', 7], equipped: { head: 'veteran.Helmet', legs: 'veteran.Helmet', chest: 'nightborn.Body', wings: 'veteran.Helmet' } }), { owned: ['veteran.Helmet'], equipped: { head: 'veteran.Helmet' } });
  // A taken weapon: owned like any piece, worn only in the main hand (never as armour), cleaned like the rest.
  assert.deepEqual(cleanLoot({ owned: ['veteran.Trident'], equipped: { main: 'veteran.Trident', head: 'veteran.Trident' } }), { owned: ['veteran.Trident'], equipped: { main: 'veteran.Trident' } });
  assert.deepEqual(wear(store(undefined, 'goblin.Knife'), 'goblin.Knife').equipped, { main: 'goblin.Knife' }); assert.deepEqual(wear(emptyLoot(), 'goblin.Knife').equipped, {}, 'cannot wield what was not taken');
  assert.deepEqual(unwear(wear(store(undefined, 'pitborn.Cleaver'), 'pitborn.Cleaver'), 'main').equipped, {}, 'putting the cleaver down leaves the hand empty (the longsword is never a piece)');
  let loot = store(undefined, 'nightborn.Body'); loot = store(loot, 'nightborn.Body'); loot = store(loot, 'veteran.Greaves');
  assert.deepEqual(loot, { owned: ['nightborn.Body', 'veteran.Greaves'], equipped: {} });
  assert.deepEqual(wear(loot, 'veteran.Greaves').equipped, { legs: 'veteran.Greaves' }); assert.deepEqual(wear(loot, 'veteran.Helmet').equipped, {}, 'cannot wear what is not owned');
  assert.deepEqual(unwear(wear(loot, 'nightborn.Body'), 'chest').equipped, {});
  assert.deepEqual(mergeLoot({ owned: ['veteran.Helmet'], equipped: { head: 'veteran.Helmet' } }, { owned: ['nightborn.Boots'], equipped: {} }), { owned: ['veteran.Helmet', 'nightborn.Boots'], equipped: { head: 'veteran.Helmet' } }, 'the union of both, the device\'s worn set when the cloud has none');
  assert.deepEqual(mergeLoot(undefined, { owned: ['nightborn.Boots'], equipped: { feet: 'nightborn.Boots' } }), { owned: ['nightborn.Boots'], equipped: { feet: 'nightborn.Boots' } });
  assert.equal(lootName('veteran.Helmet', 'the Veteran'), 'the Veteran\'s helmet');
});

test('loot: provenance is written once at the drop, cleaned like the rest, its record id fills once from null, and a merge keeps it', () => {
  const p = { opponent: 'veteran' as const, attempt: 5, healthLeft: 12, recordId: null, day: '2026-09-22' };
  let loot = store(undefined, 'veteran.Helmet', p);
  assert.deepEqual(loot, { owned: ['veteran.Helmet'], equipped: {}, taken: { 'veteran.Helmet': p } });
  assert.deepEqual(store(loot, 'veteran.Helmet', { ...p, attempt: 9 }), loot, 'a second drop of an owned piece changes nothing');
  loot = recordTaken(loot, 'veteran.Helmet', 'Ab3_-9xZ');
  assert.equal(loot.taken!['veteran.Helmet']!.recordId, 'Ab3_-9xZ');
  assert.deepEqual(recordTaken(loot, 'veteran.Helmet', 'ZZZZZZZZ'), loot, 'the record id is written once');
  assert.deepEqual(recordTaken(loot, 'veteran.Crest', 'Ab3_-9xZ'), loot, 'no provenance, nothing to fill');
  assert.deepEqual(cleanLoot(JSON.parse(JSON.stringify(loot))), loot, 'a saved record round-trips');
  assert.deepEqual(cleanLoot({ owned: ['veteran.Helmet'], equipped: {}, taken: { 'veteran.Helmet': { ...p, attempt: 0 } } }), { owned: ['veteran.Helmet'], equipped: {} }, 'a bad attempt count drops the provenance, never the piece');
  assert.deepEqual(cleanLoot({ owned: [], equipped: {}, taken: { 'veteran.Helmet': p } }), emptyLoot(), 'provenance for a piece not owned is dropped');
  assert.deepEqual(cleanProvenance({ ...p, recordId: '1a' }), { ...p, recordId: '1a' }, 'a minted short id (2026-09-22) is a valid record id'); assert.equal(cleanProvenance({ ...p, recordId: 'far-too-long-for-a-share-id' }), null); assert.equal(cleanProvenance({ ...p, day: 'yesterday' }), null); assert.equal(cleanProvenance({ ...p, opponent: 'nobody' }), null);
  assert.deepEqual(mergeLoot({ owned: ['veteran.Helmet'], equipped: {}, taken: { 'veteran.Helmet': { ...p, recordId: 'Ab3_-9xZ' } } }, { owned: ['veteran.Helmet', 'nightborn.Boots'], equipped: {}, taken: { 'veteran.Helmet': p, 'nightborn.Boots': { ...p, opponent: 'nightborn' } } }).taken,
    { 'veteran.Helmet': { ...p, recordId: 'Ab3_-9xZ' }, 'nightborn.Boots': { ...p, opponent: 'nightborn' } }, 'the device\'s filled id wins, the cloud\'s other pieces are kept');
});
