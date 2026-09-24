import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PACK, cleanLoot, mergeLoot, packFull, recoverPack, stow, wear, wearFromPack, type Loot } from '../src/loot.ts';
import { loadProfile, saveProfile, type StoragePort } from '../src/profile.ts';
import { absorbCloud, profileDiffers, type CloudProfile } from '../src/cloud-profile.ts';

// Dom's profile screenshot, 2026-09-24: Store on a worn slot unwore the piece and it vanished — the Profile tab had no pack to show it in.
const worn = (): Loot => ({ owned: ['veteran.Helmet', 'veteran.Body', 'pitborn.Boots'], equipped: { head: 'veteran.Helmet', chest: 'veteran.Body', feet: 'pitborn.Boots' } });
const memory = (): StoragePort & { value: string | null } => { const s = { value: null as string | null, getItem: () => s.value, setItem: (_k: string, v: string) => { s.value = v; } }; return s; };

test('Store moves the worn piece into the first open pack slot; the pack holds PACK.open and then refuses', () => {
  assert.equal(PACK.open, 2); assert.equal(PACK.total, 5);
  const one = stow(worn(), 'head');
  assert.deepEqual(one.pack, ['veteran.Helmet']);
  assert.equal(one.equipped.head, undefined);
  assert.ok(one.owned.includes('veteran.Helmet'), 'stored, not lost');
  const two = stow(one, 'chest');
  assert.deepEqual(two.pack, ['veteran.Helmet', 'veteran.Body']);
  assert.equal(packFull(two), true);
  assert.equal(stow(two, 'feet'), two, 'a full pack refuses: the piece stays worn');
  assert.equal(stow(worn(), 'legs').pack, undefined, 'an empty slot has nothing to store');
});

test('a stored piece is worn back from the pack; a piece already in that slot takes the pack place it left', () => {
  const packed = stow(stow(worn(), 'head'), 'chest');
  const back = wearFromPack(packed, 'veteran.Helmet');
  assert.equal(back.equipped.head, 'veteran.Helmet');
  assert.deepEqual(back.pack, ['veteran.Body']);
  const swap = wearFromPack({ ...back, owned: [...back.owned, 'pitborn.Helmet'], pack: ['pitborn.Helmet', 'veteran.Body'] }, 'pitborn.Helmet');
  assert.equal(swap.equipped.head, 'pitborn.Helmet');
  assert.deepEqual(swap.pack, ['veteran.Helmet', 'veteran.Body'], 'the helmet it replaced goes into the pack, nothing vanishes');
  assert.equal(wearFromPack(back, 'pitborn.Boots'), back, 'a piece not in the pack is not worn from it');
  assert.deepEqual(wear({ ...packed, owned: packed.owned }, 'veteran.Body').pack, ['veteran.Helmet'], 'worn any other way, it leaves the pack too: worn or packed, never both');
});

test('a stored piece survives a refresh: saved, reloaded, still in the pack and not worn', () => {
  const storage = memory();
  const first = loadProfile(storage, () => 'guest-12345678').profile;
  first.loot = stow(worn(), 'chest');
  assert.equal(saveProfile(storage, first), true);
  const again = loadProfile(storage, () => { throw new Error('must keep the guest'); }).profile;
  assert.deepEqual(again.loot?.pack, ['veteran.Body']);
  assert.equal(again.loot?.equipped.chest, undefined);
});

test('the pack is cleaned like the rest: owned, unworn, no repeats, at most PACK.open; an old record packs what Store had lost', () => {
  const loot = cleanLoot({ owned: ['veteran.Helmet', 'veteran.Body', 'pitborn.Boots'], equipped: { head: 'veteran.Helmet' }, pack: ['veteran.Helmet', 'veteran.Body', 'veteran.Body', 'nope.Hat', 'pitborn.Boots', 'pitborn.Helmet'] });
  assert.deepEqual(loot.pack, ['veteran.Body', 'pitborn.Boots'], 'worn, repeated, unknown and unowned ids dropped, capped at two');
  // Before the pack: Store unwore Dom's piece and nothing held it. With no `pack` field the owned, unworn pieces come back into it at load.
  assert.deepEqual(recoverPack(cleanLoot({ owned: ['veteran.Helmet', 'veteran.Body'], equipped: { head: 'veteran.Helmet' } })).pack, ['veteran.Body']);
  assert.equal(recoverPack(cleanLoot({ owned: ['veteran.Helmet'], equipped: { head: 'veteran.Helmet' } })).pack, undefined, 'nothing to pack, no field');
  assert.deepEqual(recoverPack(cleanLoot({ owned: ['veteran.Body'], equipped: {}, pack: [] })).pack, [], 'an emptied pack stays empty: the refill is for old records only');
  const storage = memory(); storage.value = JSON.stringify({ version: 1, id: 'guest-12345678', name: 'Dom', loot: { owned: ['veteran.Helmet', 'veteran.Body'], equipped: { head: 'veteran.Helmet' } } });
  assert.deepEqual(loadProfile(storage, () => 'x').profile.loot?.pack, ['veteran.Body'], 'Dom\'s stored-and-vanished piece is in his pack after this ships');
});

test('signed in: a Store is a change to save, and the device\'s pack is the one kept against an older cloud pack', () => {
  const device = stow(worn(), 'chest');
  const cloud: CloudProfile = { display_name: 'Aldren', encounter: null, revision: 3, victory_marks: 0, loot: worn() };
  const profile = { version: 1 as const, id: 'user-1', name: 'Aldren', loot: device };
  assert.equal(profileDiffers(profile, cloud), true, 'the pack moved: the cloud must hear it');
  assert.equal(profileDiffers(profile, { ...cloud, loot: device }), false);
  // The device wore the body back out of the pack; the cloud still has it packed. The refresh must not put it back in the pack.
  const woreBack = wearFromPack(device, 'veteran.Body');
  const absorbed = absorbCloud({ ...profile, loot: woreBack }, { ...cloud, loot: device });
  assert.equal(absorbed.loot?.equipped.chest, 'veteran.Body');
  assert.deepEqual(absorbed.loot?.pack, []);
  // Sign-in on a fresh device: the account's pack comes down with its pieces.
  assert.deepEqual(mergeLoot(undefined, device).pack, ['veteran.Body']);
});
