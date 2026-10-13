// The Zone 1 hero fights in his worn gear (Combat, series PR 1 of "the sheet in the world"): the page derives the Loadout from the server's view of the character, the server derives the SAME Loadout from the
// held rows, and a world record's hero claim is held to it: the worn claim is verified, a claim above the held set is 'hero beyond ledger'.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeWorldRecord, loadoutOfLoot, NAKED, sheetFor, type WorldRecord } from '../../src/fight/index.ts';
import { createWorldCombat as live } from '../../src/fight/world-combat.ts';
import { player } from '../../src/fight/world.ts';
import { TIERS, legacyLootOfItemId, PC } from '../../src/core/server.ts';
import { verifyWorldRecord } from './world-verify.ts';
import { heldWeaponOf, heroLimitOf, loadoutOf, loadoutOfItems, wornGearOfItems } from './worn-gear.ts';
import { DEFAULT_WEAPON, sheetOf, type Sheet } from '../../src/fight/server.ts';
import { defaultZoneSpawns, type Spawn } from './world-spawns.ts';
import { loadEncounterContent } from '../encounters/encounters.ts';
import type { Db } from './db.ts';

const loaded = loadEncounterContent(); if (!loaded.ok) throw new Error('content');
const base = [...defaultZoneSpawns(loaded.value).values()].find((s) => s.spec.character === 'character:ash-wolf') as Spawn;
const wolf: Spawn = { ...base, spec: { ...base.spec, level: 1 } };
const RUNG = 'Champion';
const held = [{ item: 'item:loot.veteran.Helmet', tier: RUNG, location: { kind: 'equipped', slot: 'head' } }, { item: 'item:loot.veteran.Body', tier: RUNG, location: { kind: 'equipped', slot: 'chest' } }];

async function killWith(sheet?: Sheet): Promise<{ rec: WorldRecord; text: string }> {
  const fell: string[] = []; let rec: WorldRecord | null = null;
  const at = { x: wolf.spec.home.x, z: wolf.spec.home.z }, spec = { id: wolf.spec.id, body: 'wolf', level: 1, name: 'wolf' };
  const mobs = { within: (x: number, z: number, r: number) => fell.length || Math.hypot(at.x - x, at.z - z) > r ? [] : [{ spec, x: at.x, z: at.z, dist: Math.hypot(at.x - x, at.z - z) }], drive: () => {} };
  const wc = live({ mobs: () => mobs, hero: () => ({ level: 1, ...(sheet ? { sheet } : {}) }), onKill: (s) => { fell.push(s.id); rec = wc.record(); }, onHeroDied: () => {}, onHeroHit: () => {} });
  const hero = { x: at.x, z: at.z - 1.2, facing: 0 };
  for (let i = 0; i < 400 && !fell.length; i++) { wc.press(); for (let t = 0; t < 0.5; t += 1 / 30) { const w = wc.debug().find((q) => q.id === spec.id); hero.facing = w ? Math.atan2(w.x - hero.x, w.z - hero.z) : 0; wc.update(1 / 30, hero); } }
  assert.ok(rec, 'the scripted hero kills the wolf');
  return { rec: rec!, text: await encodeWorldRecord(rec!) };
}

test('the page and the server derive the same worn Loadout from the same pieces', () => {
  const equipped: Record<string, NonNullable<ReturnType<typeof legacyLootOfItemId>>> = {}, taken: Record<string, { tier: number }> = {};
  for (const h of held) { const id = legacyLootOfItemId(h.item as Parameters<typeof legacyLootOfItemId>[0])!; equipped[h.location.slot] = id; taken[id] = { tier: TIERS.indexOf(h.tier as (typeof TIERS)[number]) + 1 }; }
  const client = loadoutOfLoot({ equipped, taken } as never), server = loadoutOfItems(held);
  assert.deepEqual(client, server);
  assert.ok(server.res < NAKED.res && server.attack >= NAKED.attack, 'a worn Champion armour set lowers the damage taken (RES), and no weapon leaves Attack at base');
  assert.deepEqual(loadoutOfItems([]), NAKED, 'nothing worn: bare');
  assert.deepEqual(loadoutOfItems([{ ...held[0]!, location: { kind: 'pack' } }]), NAKED, 'a piece in the pack is not worn');
  assert.deepEqual(loadoutOfLoot(undefined), NAKED);
});

test('loadoutOf reads the held rows of the character, and only theirs', async () => {
  const rows = held.map((h) => ({ item: h.item, tier: h.tier, loc_kind: 'equipped', loc_owner: PC, loc_slot: h.location.slot }));
  const other = { item: 'item:loot.veteran.Crest', tier: RUNG, loc_kind: 'equipped', loc_owner: 'pc:someone-else', loc_slot: 'head' };
  const db: Db = { async run() { return JSON.stringify({ marks: 0, career: {}, characters: [], items: [...rows, other], quests: [], journal: [], talk: [] }); } };
  assert.deepEqual(await loadoutOf(db, '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b', PC), loadoutOfItems(held));
});

test('the hero fights on his sheet: the world fighter carries it, and a bare hero is the Pit\'s own', () => {
  const sheet = sheetOf({ level: 0, placed: {} }, wornGearOfItems(held))!, p = player('hero', 0, 0, 0, 1, null, { sheet });
  assert.deepEqual(p.sheet, sheet); assert.ok(p.maxHealth > 0);
  assert.equal(player('hero', 0, 0, 0, 1).sheet, undefined, 'no sheet given: bare, as the Pit builds him');
});

test('verify: the sheet claim must EQUAL the held set\'s; the worn claim is verified, a bare or inflated claim is refused as a sheet mismatch', async () => {
  const worn = sheetOf({ level: 0, placed: {} }, wornGearOfItems(held))!, claim = await killWith(worn), bare = await killWith();
  assert.ok((await verifyWorldRecord(claim.text, wolf, 'wolf', { sheet: worn })).ok, 'the worn claim matches the held set: verified (and so paid)');
  for (const [why, text, limit] of [['a worn claim over a bare held set', claim.text, undefined], ['a bare claim under a worn set', bare.text, worn]] as const) {
    const v = await verifyWorldRecord(text, wolf, 'wolf', { sheet: limit });
    assert.ok(!v.ok && v.reason === 'sheet', `${why}: refused as a sheet mismatch`);
  }
  assert.ok((await verifyWorldRecord(bare.text, wolf, 'wolf', { sheet: undefined })).ok, 'naked unchanged');
  const forged = await killWith({ ...worn, attack: (worn.attack ?? 0) + 5 });
  const f = await verifyWorldRecord(forged.text, wolf, 'wolf', { sheet: worn });
  assert.ok(!f.ok && f.reason === 'sheet', 'a forged attack above the held sheet is refused');
});

test('heroLimitOf: the sheet the stored build and worn gear give (the record must equal it); a bare character owes none; an illegal build refuses', async () => {
  const rows = held.map((h) => ({ item: h.item, tier: h.tier, loc_kind: 'equipped', loc_owner: PC, loc_slot: h.location.slot }));
  const dbOf = (build: string, items: unknown[]): Db => ({ async run(sql) {
    if (sql.includes('origins_get_build')) return build;
    return JSON.stringify({ marks: 0, career: {}, characters: [], items, quests: [], journal: [], talk: [] });
  } });
  const A = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b';
  const placed = await heroLimitOf(dbOf(JSON.stringify({ level: 10, placed: { attack: 10 }, respreadRank: 1, version: 1 }), rows), A, PC);
  assert.deepEqual(placed.sheet, sheetOf({ level: 10, placed: { attack: 10 } }, wornGearOfItems(held)));
  assert.ok(placed.sheet && 'sheet' in placed, 'a sheet is owed');
  assert.equal(placed.weapon, heldWeaponOf(held), 'the held main hand is the weapon the record must carry');
  assert.equal(heldWeaponOf([]), DEFAULT_WEAPON, 'nothing in the main hand fights with the default');
  const bare = await heroLimitOf(dbOf('null', []), A, PC);
  assert.ok('sheet' in bare && bare.sheet === undefined && !bare.refuse, 'no build, no gear: the record must carry no sheet');
  const illegal = await heroLimitOf(dbOf(JSON.stringify({ level: 1, placed: { attack: 99 }, respreadRank: 1, version: 1 }), []), A, PC);
  assert.match(illegal.refuse ?? '', /not a legal one/);
});

test('end to end: a geared, built character fights with the page\'s sheet and verifies under heroLimitOf; a sheetless or inflated record does not', async () => {
  const equipped: Record<string, NonNullable<ReturnType<typeof legacyLootOfItemId>>> = {}, taken: Record<string, { tier: number }> = {};
  for (const h of held) { const id = legacyLootOfItemId(h.item as Parameters<typeof legacyLootOfItemId>[0])!; equipped[h.location.slot] = id; taken[id] = { tier: TIERS.indexOf(h.tier as (typeof TIERS)[number]) + 1 }; }
  const own = { level: 10, placed: { attack: 10 } };
  const pageSheet = sheetFor({ equipped, taken } as never, own);
  assert.ok(pageSheet, 'gear and a placed point move the dials');
  const rows = held.map((h) => ({ item: h.item, tier: h.tier, loc_kind: 'equipped', loc_owner: PC, loc_slot: h.location.slot }));
  const db: Db = { async run(sql) { return sql.includes('origins_get_build') ? JSON.stringify({ ...own, respreadRank: 1, version: 1 }) : JSON.stringify({ marks: 0, career: {}, characters: [], items: rows, quests: [], journal: [], talk: [] }); } };
  const A = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b', limit = await heroLimitOf(db, A, PC);
  const geared = await killWith(loadoutOfLoot({ equipped, taken } as never), pageSheet);
  const ok = await verifyWorldRecord(geared.text, wolf, 'wolf', limit);
  assert.ok(ok.ok, `the page's sheet is the server's: ${JSON.stringify(ok)}`);
  const naked = await killWith(NAKED);
  assert.deepEqual(await verifyWorldRecord(naked.text, wolf, 'wolf', limit), { ok: false, reason: 'sheet' }, 'a sheetless record from a geared character is refused');
  const inflated = await killWith(NAKED, { ...pageSheet, attack: 100 });
  assert.deepEqual(await verifyWorldRecord(inflated.text, wolf, 'wolf', limit), { ok: false, reason: 'sheet' });
});
