import assert from 'node:assert/strict';
import test from 'node:test';
import { PC, isLootId, slotOf } from '../../src/core/server.ts';
import { lootOfView, stepsToWear, viewOf } from '../../src/core/gear-ledger.ts';
import { loadEncounterContent, lookupOf } from '../encounters/encounters.ts';
import { ITEMS } from '../region1/content.ts';
import { STARTER_WIELD, loadStarterWield, lootIdOfItem } from '../region1/starter-wield.ts';
import DATA from '../region1/starter-wield.json' with { type: 'json' };
import type { Db } from './db.ts';
import { gearHandlers, gearView } from './gear.ts';
import { heldWeaponOf, wornGearOfItems } from './worn-gear.ts';

const loaded = loadEncounterContent();
if (!loaded.ok) throw new Error('Region 1 content must load for these tests');
const UID = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b';
const career = { seed_credit: 0, world_credit: 0, total_credit: 0, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 1 };
const row = (n: number, item: string, loc: Record<string, unknown>) => ({
  id: `inst:t-${n}`, item, version: 2, quantity: 1, tier: null, upgrade_level: 0, loc_kind: loc.kind, loc_owner: PC, loc_index: loc.index ?? null, loc_slot: loc.slot ?? null,
  bound_to: PC, mint_key: `shop:t:${n}`, provenance: { kind: 'shop', at: '2026-10-06T12:00:00Z', boughtBy: PC, shop: 'service:exchange-provisioner' }, history: [],
});
function stub(items: unknown[]) {
  const commits: { op: string; id: string; loc: { kind: string; slot?: string } }[][] = [];
  const db: Db = { async run(sql, v = {}) {
    if (/origins_commit/.test(sql)) { commits.push(JSON.parse(v.b!)); return '[]'; }
    return JSON.stringify({ marks: 0, career, characters: [{ id: PC, pack_slots: 64, bank_slots: 1000 }], items, quests: [], journal: [], talk: [] });
  } };
  return { db, commits };
}
const ops = gearHandlers({ lookup: lookupOf(loaded.value) });
const ctx = (db: Db) => ({ db, account: UID });

test('every starter gear item names a LootId of its own slot, except the rusty sword (no live Longsword LootId yet: Combat adds one)', () => {
  const starters = ITEMS.filter((d) => String(d.id).startsWith('item:starter.') && d.category === 'gear');
  assert.equal(starters.length, 7);
  for (const d of starters) {
    const id = STARTER_WIELD.get(String(d.id));
    if (d.id === 'item:starter.rusty-sword') { assert.equal(id, undefined); continue; }
    assert.ok(id && isLootId(id), `${d.id} has a row naming a LootId`);
    assert.equal(slotOf(id), d.slot, `${d.id}: the stand-in LootId is the same slot`);
  }
  assert.equal(STARTER_WIELD.size, 6);
});

test('the loader refuses a non-starter item, an unknown LootId and a duplicate id', () => {
  const rows = DATA.wield;
  assert.throws(() => loadStarterWield({ wield: [{ id: 'item:frontier.watch-greaves', lootId: 'goblin.Greaves' }] }), /only an item:starter/);
  assert.throws(() => loadStarterWield({ wield: [{ id: 'item:starter.knife', lootId: 'goblin.Nonsense' }] }), /not a LootId/);
  assert.throws(() => loadStarterWield({ wield: [...rows, rows[0]!] }), /duplicate|twice|unique/i);
});

test('lootIdOfItem: a legacy loot piece is its own, a starter item its row, anything else none', () => {
  assert.equal(lootIdOfItem('item:loot.goblin.Helmet'), 'goblin.Helmet');
  assert.equal(lootIdOfItem('item:starter.knife'), 'goblin.Knife');
  assert.equal(lootIdOfItem('item:starter.rusty-sword'), null);
  assert.equal(lootIdOfItem('item:grave-iron'), null);
});

test('gear_open: a packed starter knife carries a LootId, the sheet keeps it, and the wear step is ONE gear_equip onto the main hand', async () => {
  const s = stub([row(1, 'item:starter.knife', { kind: 'pack', index: 0 })]);
  const out = await ops.gear_open!(ctx(s.db), { character: PC }) as ReturnType<typeof gearView>;
  assert.deepEqual(out.pieces.map((p) => [p.item, p.lootId, p.where]), [['item:starter.knife', 'goblin.Knife', 'pack']]);
  const view = viewOf(out)!;
  assert.deepEqual(lootOfView(view).owned, ['goblin.Knife'], 'the sheet draws it (lootOfView no longer drops it)');
  assert.deepEqual(stepsToWear(view, 'goblin.Knife'), [{ op: 'gear_equip', id: 'inst:t-1' }]);
  await ops.gear_equip!(ctx(s.db), { character: PC, id: 'inst:t-1' });
  assert.deepEqual(s.commits.flat().map((c) => [c.op, c.id, c.loc.kind, c.loc.slot]), [['put', 'inst:t-1', 'equipped', 'main']]);
});

test('a worn starter piece shows on the paperdoll, in the worn set others see and in the fight weapon', async () => {
  const s = stub([row(1, 'item:starter.knife', { kind: 'equipped', slot: 'main' }), row(2, 'item:starter.goblin-scrap-cap', { kind: 'equipped', slot: 'head' })]);
  const out = await ops.gear_open!(ctx(s.db), { character: PC }) as ReturnType<typeof gearView>;
  assert.deepEqual(lootOfView(viewOf(out)!).equipped, { main: 'goblin.Knife', head: 'goblin.Helmet' });
  const held = [{ item: 'item:starter.knife', tier: null, location: { kind: 'equipped', slot: 'main' } }, { item: 'item:starter.goblin-scrap-cap', tier: null, location: { kind: 'equipped', slot: 'head' } }];
  const real = [{ item: 'item:loot.goblin.Knife', tier: null, location: { kind: 'equipped', slot: 'main' } }, { item: 'item:loot.goblin.Helmet', tier: null, location: { kind: 'equipped', slot: 'head' } }];
  assert.equal(heldWeaponOf(held), heldWeaponOf(real), 'the starter knife fights as the knife it stands for');
  assert.deepEqual(wornGearOfItems(held), wornGearOfItems(real));
});

test('a rusty sword stays a bare piece for now (null LootId): held, never drawn, never refused', async () => {
  const s = stub([row(1, 'item:starter.rusty-sword', { kind: 'pack', index: 0 })]);
  const out = await ops.gear_open!(ctx(s.db), { character: PC }) as ReturnType<typeof gearView>;
  assert.deepEqual(out.pieces.map((p) => p.lootId), [null]);
  assert.deepEqual(lootOfView(viewOf(out)!).owned, []);
});
