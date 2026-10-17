// A guest's kill rolls the same loot table the server pays from, usable this session and saved nowhere (Dom, 2026-10-16: Zone 1 is open to a signed-out player).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fightSetup, loadEncounterContent, rollLoot } from '../encounters/encounters.ts';
import { guestBag, guestKillLoot } from './guest-loot.ts';
import { GUEST_SIGN_IN_LOSS, killToast } from './kill-apply.ts';
import KILL_TEXT from './kill-text.json' with { type: 'json' };
import GROUND from './ground-pickup.json' with { type: 'json' };

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
  assert.equal(killToast({ offline: 'no-session' }, name, 'Wolf', false, guest), 'Wolf is down. +3 bronze · pelt ×2 (this session only).');
  assert.equal(killToast({ offline: 'no-session' }, name, 'Wolf', true, { loot: [{ item: 'pelt', quantity: 1 }], bronze: 0 }), 'Wolf is down. pelt (this session only). Bounty done.');
  assert.equal(killToast({ offline: 'no-session' }, name, 'Wolf', false, { loot: [], bronze: 0 }), 'Wolf is down. Sign in to earn loot you keep.');
  assert.equal(killToast({ offline: 'timeout' }, name, 'Wolf', false, guest), 'Wolf is down. Not saved: the server did not answer.', 'a signed-in page the server did not answer is never shown guest loot');
});
test('a guest is told the truth about sign-in (SCOPE guest acceptance item 4): the loss line is a row, and no guest copy promises that signing in keeps session loot', () => {
  assert.equal(GUEST_SIGN_IN_LOSS, KILL_TEXT.guest.signInLoss);
  assert.match(GUEST_SIGN_IN_LOSS, /starts fresh/); assert.match(GUEST_SIGN_IN_LOSS, /not kept/);
  const guestCopy = [KILL_TEXT.toast.guestLoot, KILL_TEXT.toast.guestNoLoot, JSON.stringify(GROUND.groundPickup[0]!.fields.labels)].join(' ');
  assert.doesNotMatch(guestCopy, /sign in to keep/i, 'the loot a guest holds is session-only (guest-loot.ts): signing in is a new page and the roll is unverified, so nothing promises it is kept');
});
