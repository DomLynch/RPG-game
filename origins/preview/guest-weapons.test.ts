// A guest's picked-up weapon is wieldable for the session and stored nowhere (guest-weapons.ts); a signed-in page reads none of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLocal, emptyLoot, type Loot } from '../../src/core/index.ts';
import { PLAYER_WEAPONS } from '../../src/fight/index.ts';
import { STARTER_WIELD } from '../region1/starter-wield.ts';
import { guestBag } from './guest-loot.ts';
import { guestProfile, guestWeapon, sessionWeapons, withoutSession } from './guest-weapons.ts';

const standsAs = (item: string) => STARTER_WIELD.get(item);
const bagWith = (...items: string[]) => { const bag = guestBag(); for (const item of items) bag.add({ loot: [{ item, quantity: 1 }], bronze: 0 }); return bag; };

test('a guest bag with the starter bow lists it in the gear sheet and setting MAIN HAND makes the hero weapon bow; the device stores none of it', () => {
  const bag = bagWith('item:starter.bow', 'item:starter.staff'), held = () => sessionWeapons(bag.items(), standsAs);
  assert.deepEqual(held(), ['starter.Bow', 'starter.Staff']);
  const device: { loot?: Loot } = { loot: emptyLoot() }, sheet = guestProfile(device, held), carried = PLAYER_WEAPONS;
  assert.deepEqual(sheet.loot.owned, ['starter.Bow', 'starter.Staff']);   // the rack lists them
  assert.deepEqual(sheet.loot.pack, ['starter.Bow', 'starter.Staff']);   // and the pack shows them (no "Nothing stored")
  assert.equal(guestWeapon(sheet.loot, held(), carried), 'longsword', 'not wielded until set');
  sheet.loot = applyLocal(sheet.loot, { kind: 'wear', id: 'starter.Bow' });   // the sheet's Wear op, the same path the gear screen takes
  assert.equal(sheet.loot.equipped.main, 'starter.Bow');
  assert.deepEqual(sheet.loot.pack, ['starter.Staff']);
  assert.equal(guestWeapon(sheet.loot, held(), carried), 'bow');
  assert.deepEqual({ ...device.loot, pack: device.loot?.pack ?? [] }, { ...emptyLoot(), pack: [] }, 'nothing of the session weapon reaches the stored profile');
  sheet.loot = applyLocal(sheet.loot, { kind: 'wear', id: 'starter.Staff' });   // another main hand replaces it
  assert.equal(guestWeapon(sheet.loot, held(), carried), 'staff');
  sheet.loot = applyLocal(sheet.loot, { kind: 'unwear', key: 'main' });
  assert.equal(guestWeapon(sheet.loot, held(), carried), 'longsword');
  assert.deepEqual(sheet.loot.pack, ['starter.Bow', 'starter.Staff'], 'taken off, both are in the pack again (session view)');
});

test('a signed-in page holds none: no session weapons, the device ledger is the ledger unchanged', () => {
  const device: { loot?: Loot } = { loot: emptyLoot() }, sheet = guestProfile(device, () => []);
  assert.deepEqual(sheet.loot, device.loot);
  const next = applyLocal({ ...emptyLoot(), owned: ['goblin.Helmet'] }, { kind: 'wear', id: 'goblin.Helmet' });
  sheet.loot = next;
  assert.deepEqual(device.loot, next);
  assert.deepEqual(withoutSession(next, []), next);
});

test('only weapon pieces count, and an item with no LootId is ignored', () => {
  assert.deepEqual(sessionWeapons([{ item: 'item:starter.goblin-scrap-cap' }, { item: 'item:nope' }, { item: 'item:starter.bow' }, { item: 'item:starter.bow' }], standsAs), ['starter.Bow']);
});

test('a device-stored main hand is not a guest wield: only a session weapon is', () => {
  const loot: Loot = { ...emptyLoot(), owned: ['goblin.Knife'], equipped: { main: 'goblin.Knife' } };
  assert.equal(guestWeapon(loot, [], PLAYER_WEAPONS), 'longsword');
});
