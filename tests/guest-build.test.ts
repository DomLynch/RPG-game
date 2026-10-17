// A guest's session-only build (src/core/build-guest.ts, Lead 2026-10-17): placed in memory, level from the local career counter, nothing stored or sent, a reload resets it, and his world kills stay unverified and
// unpaid. The fight's sheet takes it (sheetFor, as the Pit does) so a newcomer is no longer stuck on the base sheet whatever the HUD level says.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuestBuild } from '../src/core/build-guest.ts';
import { ROWS, canPlace, place, unspent } from '../src/core/build-model.ts';
import { sheetFor } from '../src/fight/gear-numbers.ts';
import { spawnTracker } from '../origins/preview/spawn-net.ts';

const noNetwork = () => { const calls: string[] = []; const fetch = (async (url: unknown) => { calls.push(String(url)); throw new Error('a guest touches no network'); }) as typeof globalThis.fetch; return { calls, fetch }; };

test('a guest places points in memory: the budget follows the live level, the rows refuse an overspend, a new session starts empty', async () => {
  let level = 16; const g = createGuestBuild(() => level);
  assert.deepEqual(g.view(), { level: 16, placed: {}, respreadRank: 0, version: 0 }); assert.ok(unspent(g.view()) > 0, 'a level 16 guest has points to place');
  const dial = ROWS.find((r) => r.kind === 'dial')!, next = place(g.view(), dial.id);
  assert.equal(await g.save(next), 'saved'); assert.equal(g.view().placed[dial.id], 1); assert.equal(g.view().version, 1); assert.deepEqual(g.own(), { level: 16, placed: { [dial.id]: 1 } });
  assert.equal(await g.save({ ...g.view(), placed: { [dial.id]: 999 } }), 'offline', 'more than the rows and the budget allow is refused as the server refuses it'); assert.equal(g.view().placed[dial.id], 1, 'and nothing changed');
  level = 17; assert.equal(g.view().level, 17, 'the level is the counter, read live'); assert.deepEqual(await g.refresh(), g.view());
  assert.deepEqual(createGuestBuild(() => 16).view().placed, {}, 'a reload is a new guest build: empty');
});

test('a guest touches no storage and no network: saving a build sends nothing and keeps nothing', async () => {
  const net = noNetwork(), real = { fetch: globalThis.fetch, storage: (globalThis as { localStorage?: unknown }).localStorage }, writes: string[] = [];
  globalThis.fetch = net.fetch; (globalThis as { localStorage?: unknown }).localStorage = { setItem: (k: string) => writes.push(k), getItem: () => null, removeItem: (k: string) => writes.push(k) };
  try {
    const g = createGuestBuild(() => 16), dial = ROWS.find((r) => r.kind === 'dial')!;
    assert.ok(canPlace(g.view(), dial.id)); await g.save(place(g.view(), dial.id)); await g.refresh();
    assert.deepEqual(net.calls, [], 'no request'); assert.deepEqual(writes, [], 'nothing stored');
  } finally { globalThis.fetch = real.fetch; (globalThis as { localStorage?: unknown }).localStorage = real.storage; }
});

test('the fight sheet takes a guest\'s placed point (sheetFor with his session build), and a guest with none is on the base sheet', () => {
  const none = sheetFor(undefined, { level: 16, placed: {} }), dials = ROWS.filter((r) => r.kind === 'dial');
  const moved = dials.filter((d) => JSON.stringify(sheetFor(undefined, { level: 16, placed: { [d.id]: 1 } })) !== JSON.stringify(none));
  assert.ok(moved.length > 0, 'at least one dial changes the sheet when a point is placed on it');
});

test('a guest\'s world kill stays unverified and unpaid: with no token and no character nothing is engaged or reported, whatever his sheet', async () => {
  const net = noNetwork(), t = spawnTracker({ token: () => null, character: () => null, now: () => 0, fetch: net.fetch });
  assert.deepEqual(await t.engaged('wolves-1'), { offline: 'no-character' }, 'no engage without a character');
  t.hit('wolves-1'); t.hit('wolves-1');
  const k = await t.killed('wolves-1');
  assert.ok('offline' in k, `the kill is not reported: ${JSON.stringify(k)}`); assert.deepEqual(net.calls, [], 'not one request: nothing for the writer to verify or pay');
});
