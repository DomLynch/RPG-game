// The per-legend defeat record (loot.ts `defeats`, Strategy 2026-09-30, the Pit's 10×10 skull wall): portrait keys `<opponent>-<rank>`,
// set on every career win (tests/match.test.ts), backfilled from every tiered kill on record, a union on every merge, and a reason to save.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanLoot, defeat, keepsLoot, mergeLoot, type Loot, type Provenance } from '../src/loot.ts';
import { profileDiffers } from '../src/cloud-profile.ts';
import { loadProfile, saveProfile, type Profile } from '../src/profile.ts';
import { PORTRAIT_KEYS } from '../src/legends.ts';

const kill = (opponent: Provenance['opponent'], tier?: number, attempt = 1): Provenance => ({ opponent, attempt, healthLeft: 10, recordId: null, day: '2026-09-29', ...(tier ? { tier } : {}) });
const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

test('defeats: backfilled from taken and declined kills that carry a tier; untiered kills, unknown keys and duplicates give nothing', () => {
  const loot = cleanLoot({ owned: ['goblin.Body'], equipped: {}, taken: { 'goblin.Body': kill('goblin', 3) }, declined: [kill('veteran', 1), kill('veteran', 1, 2), kill('knight'), kill('witch', 10)], defeats: ['dwarf-2', 'dwarf-2', 'dwarf-11', 'hoplite-1', 'veteran-1', 42] });
  assert.deepEqual(loot.defeats, ['veteran-1', 'goblin-3', 'dwarf-2', 'witch-10'], 'wall order (PORTRAIT_KEYS), legend keys only');
  assert.equal(cleanLoot({ owned: [], equipped: {} }).defeats, undefined, 'no kills, no field');
  assert.equal(PORTRAIT_KEYS.length, 100);
});

test('defeats: a win marks the legend at the fight level\'s rank, once; a non-legend opponent marks nothing', () => {
  const first = defeat(undefined, 'veteran', 1)!;
  assert.deepEqual(first.defeats, ['veteran-1']);
  assert.deepEqual(first.owned, [], 'no piece');
  assert.deepEqual(defeat(first, 'knight', 46)!.defeats, ['veteran-1', 'knight-10'], 'level 46 is the tenth rank');
  assert.equal(defeat(first, 'veteran', 1), first, 'already on the wall: unchanged');
  assert.equal(defeat(first, 'hoplite' as never, 5), first);
});

test('defeats: the merge is a union and the device saves a skull the account lacks, never a backfilled one it already implies', () => {
  const cloud: Loot = { owned: [], equipped: {}, defeats: ['pitborn-2'] }, device: Loot = { owned: [], equipped: {}, defeats: ['veteran-1'] };
  assert.deepEqual(mergeLoot(device, cloud).defeats, ['veteran-1', 'pitborn-2']);
  const row = (loot: Loot) => ({ display_name: 'Fighter', encounter: null, revision: 1, victory_marks: 0, loot });
  const profile = (loot: Loot): Profile => ({ version: 1, id: 'device-123', name: 'Fighter', loot });
  assert.equal(profileDiffers(profile(device), row(cloud)), true, 'a new skull is a change to save');
  assert.equal(profileDiffers(profile({ owned: [], equipped: {}, defeats: ['pitborn-2'] }), row({ owned: [], equipped: {}, defeats: ['pitborn-2', 'veteran-1'] })), false, 'a skull only the account has is not the device\'s to save');
  // A cloud row written before the field (taken only) and a device holding the same kill as a stored skull read the same: no write.
  const taken = { 'goblin.Body': kill('goblin', 3) };
  assert.equal(profileDiffers(profile({ owned: ['goblin.Body'], equipped: {}, taken, defeats: ['goblin-3'] }), row({ owned: ['goblin.Body'], equipped: {}, taken })), false);
});

test('defeats: a fighter whose only loot is a skull keeps it through save and load', () => {
  const loot = defeat(undefined, 'executioner', 20)!;
  assert.equal(keepsLoot(loot), true);
  const storage = memory();
  assert.ok(saveProfile(storage, { version: 1, id: 'device-123', name: 'Fighter', loot }));
  assert.deepEqual(loadProfile(storage, () => 'x').profile.loot?.defeats, loot.defeats);
});

// The Pit (2026-09-30): a player who refused every piece still has his wall.
test('defeats: a stored wall with no taken pieces survives cleanLoot; untiered declines neither add nor remove a skull', () => {
  const loot = cleanLoot({ owned: [], equipped: {}, declined: [kill('veteran')], defeats: ['veteran-1', 'knight-10'] });
  assert.deepEqual(loot.defeats, ['veteran-1', 'knight-10']);
  assert.equal(loot.taken, undefined);
});
