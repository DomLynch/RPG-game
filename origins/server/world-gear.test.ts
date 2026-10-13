// The Zone 1 hero fights in his worn gear (Combat, series PR 1 of "the sheet in the world"): the page derives the Loadout from the server's view of the character, the server derives the SAME Loadout from the
// held rows, and a world record's hero claim is held to it: the worn claim is verified, a claim above the held set is 'hero beyond ledger'.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeWorldRecord, loadoutOfLoot, NAKED, type WorldRecord } from '../../src/fight/index.ts';
import { createWorldCombat as live } from '../../src/fight/world-combat.ts';
import { player } from '../../src/fight/world.ts';
import { TIERS, legacyLootOfItemId, PC } from '../../src/core/server.ts';
import { verifyWorldRecord } from './world-verify.ts';
import { loadoutOf, loadoutOfItems } from './worn-gear.ts';
import { defaultZoneSpawns, type Spawn } from './world-spawns.ts';
import { loadEncounterContent } from '../encounters/encounters.ts';
import type { Db } from './db.ts';

const loaded = loadEncounterContent(); if (!loaded.ok) throw new Error('content');
const base = [...defaultZoneSpawns(loaded.value).values()].find((s) => s.spec.character === 'character:ash-wolf') as Spawn;
const wolf: Spawn = { ...base, spec: { ...base.spec, level: 1 } };
const RUNG = 'Champion';
const held = [{ item: 'item:loot.veteran.Helmet', tier: RUNG, location: { kind: 'equipped', slot: 'head' } }, { item: 'item:loot.veteran.Body', tier: RUNG, location: { kind: 'equipped', slot: 'chest' } }];

async function killWith(gear: { attack: number; res: number }): Promise<{ rec: WorldRecord; text: string }> {
  const fell: string[] = []; let rec: WorldRecord | null = null;
  const at = { x: wolf.spec.home.x, z: wolf.spec.home.z }, spec = { id: wolf.spec.id, body: 'wolf', level: 1, name: 'wolf' };
  const mobs = { within: (x: number, z: number, r: number) => fell.length || Math.hypot(at.x - x, at.z - z) > r ? [] : [{ spec, x: at.x, z: at.z, dist: Math.hypot(at.x - x, at.z - z) }], drive: () => {} };
  const wc = live({ mobs: () => mobs, hero: () => ({ gear, level: 1 }), onKill: (s) => { fell.push(s.id); rec = wc.record(); }, onHeroDied: () => {}, onHeroHit: () => {} });
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

test('the hero fights in what he wears: the world fighter carries the Loadout it was given', () => {
  const g = loadoutOfItems(held), p = player('hero', 0, 0, 0, g, 1);
  assert.equal(p.attack, g.attack); assert.equal(p.res, g.res);
  assert.equal(player('hero', 0, 0, 0, undefined, 1).attack, NAKED.attack, 'no gear given: naked, as before');
});

test('verify: the worn claim is verified against the held set; a claim above it is refused; a bare hero is unchanged', async () => {
  const worn = loadoutOfItems(held), claim = await killWith(worn), bare = await killWith(NAKED);
  const limitOf = (l: { attack: number; res: number }) => ({ attack: l.attack, res: l.res });
  assert.ok((await verifyWorldRecord(claim.text, wolf, 'wolf', limitOf(worn))).ok, 'the worn claim matches the held set: verified (and so paid)');
  const above = await verifyWorldRecord(claim.text, wolf, 'wolf', limitOf(NAKED));
  assert.ok(!above.ok && above.reason === 'hero beyond ledger', 'a Champion claim over a bare held set is refused');
  assert.ok((await verifyWorldRecord(bare.text, wolf, 'wolf', limitOf(worn))).ok, 'a bare claim under a worn set is fine');
  assert.ok((await verifyWorldRecord(bare.text, wolf, 'wolf', limitOf(NAKED))).ok, 'naked unchanged');
  const forged = await killWith({ attack: worn.attack + 0.05, res: worn.res });
  const f = await verifyWorldRecord(forged.text, wolf, 'wolf', limitOf(worn));
  assert.ok(!f.ok && f.reason === 'hero beyond ledger', 'a forged attack above the held set is refused');
});
