// A guest's kill rolls the same loot table the server pays from, usable this session and saved nowhere (Dom, 2026-10-16: Zone 1 is open to a signed-out player).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fightSetup, loadEncounterContent, rollLoot } from '../encounters/encounters.ts';
import { guestBag, guestKillLoot } from './guest-loot.ts';
import { killToast } from './kill-apply.ts';

const loaded = loadEncounterContent();
if (!loaded.ok) throw new Error('Region 1 content must load for these tests');
const content = loaded.value, creatures = Object.keys(content.local.creatureLoot).filter((id) => fightSetup(id, content).ok);
const level = (fight: string): number => { const s = fightSetup(fight, content); if (!s.ok) throw new Error(fight); return s.value.opponent.level; };
const name = (id: string) => id;

test('a guest kill pays the same table, seed and level as the server roll, for every Zone 1 creature with loot', () => {
  assert.ok(creatures.length > 0);
  for (const fight of creatures) for (const seed of [1, 7, 42, 1234]) {
    const server = rollLoot(content.local.creatureLoot[fight], seed, content, { foeLevel: level(fight) }), guest = guestKillLoot(content, fight, level(fight), seed);
    assert.ok(server.ok && guest, fight);
    assert.deepEqual(guest, { loot: server.value.items.map((d) => ({ item: d.item, quantity: d.quantity })), bronze: server.value.metal }, `${fight} seed ${seed}`);
  }
  assert.equal(guestKillLoot(content, 'character:nobody', 3, 1), null, 'a row with no table drops nothing');
});

test('the guest bag holds the session loot in memory, adds up stacks, and a fresh page starts empty', () => {
  const bag = guestBag();
  bag.add({ loot: [{ item: 'pelt', quantity: 2 }], bronze: 3 }); bag.add({ loot: [{ item: 'pelt', quantity: 1 }, { item: 'fang', quantity: 1 }], bronze: 2 });
  assert.deepEqual(bag.items(), [{ item: 'pelt', quantity: 3 }, { item: 'fang', quantity: 1 }]);
  assert.equal(bag.bronze(), 5);
  assert.deepEqual(guestBag().items(), []);
});

test('a guest kill writes nothing: no storage, no network, no clock; the roll is a pure function of the content and the seed', () => {
  const calls: string[] = [], g = globalThis as unknown as Record<string, unknown>, saved = { fetch: g.fetch, localStorage: g.localStorage };
  g.fetch = () => { calls.push('fetch'); throw new Error('network'); };
  g.localStorage = { setItem: () => calls.push('setItem'), getItem: () => calls.push('getItem'), removeItem: () => calls.push('removeItem') };
  try {
    const fight = creatures[0]!, a = guestKillLoot(content, fight, level(fight), 99), b = guestKillLoot(content, fight, level(fight), 99), bag = guestBag();
    if (a) bag.add(a);
    assert.deepEqual(a, b);
  } finally { g.fetch = saved.fetch; g.localStorage = saved.localStorage; }
  assert.deepEqual(calls, []);
});

test('the toast shows a guest what the table rolled with the sign-in nudge (copy from kill-text.json), never CP, and falls back to the plain nudge when nothing rolled', () => {
  const guest = { loot: [{ item: 'pelt', quantity: 2 }], bronze: 3 };
  assert.equal(killToast({ offline: 'no-session' }, name, 'Wolf', false, guest), 'Wolf is down. +3 bronze · pelt ×2 (sign in to keep it).');
  assert.equal(killToast({ offline: 'no-session' }, name, 'Wolf', true, { loot: [{ item: 'pelt', quantity: 1 }], bronze: 0 }), 'Wolf is down. pelt (sign in to keep it). Bounty done.');
  assert.equal(killToast({ offline: 'no-session' }, name, 'Wolf', false, { loot: [], bronze: 0 }), 'Wolf is down. Sign in to keep loot.');
  assert.equal(killToast({ offline: 'timeout' }, name, 'Wolf', false, guest), 'Wolf is down. Not saved: the server did not answer.', 'a signed-in page the server did not answer is never shown guest loot');
});
