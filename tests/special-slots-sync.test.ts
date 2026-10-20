// The special slots follow the account (src/core/special-sync.ts over special-equip.ts and special-net.ts, Backend #3422): a signed-in swap is one write of the final pair and persists across a fresh context (an empty device cache
// reads the server's copy), an account with nothing stored takes the device's picks up, a stale or unanswered server changes nothing, and a guest sends nothing.
import './lib/era-off.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { adoptSpecialSlots, equipSpecial, equippedSpecials, useSpecialPush, useSpecialStore } from '../src/core/special-equip.ts';
import { pullSpecialSlots, pushSpecialSlotsOnPick } from '../src/core/special-sync.ts';

const mem = (): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> => { const data = new Map<string, string>(); return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } }; };
type Row = { slot1: string | null; slot2: string | null };
/** A tiny writer: POST /origins/special_slots_get|set for one account's character; `down` answers 503 (the migration not applied yet). */
const writer = (initial: Row | null, down = false) => {
  const state = { row: initial, calls: [] as { op: string; body: Record<string, unknown> }[] };
  const fetcher = (async (url: string, init: { body: string }) => {
    const op = String(url).split('/').pop() as string, body = JSON.parse(init.body) as Record<string, unknown>; state.calls.push({ op, body });
    if (down) return new Response('{}', { status: 503 });
    if (op === 'special_slots_set') state.row = { slot1: (body.slot1 as string | null) ?? null, slot2: (body.slot2 as string | null) ?? null };
    return new Response(JSON.stringify({ ok: true, result: state.row ?? { slot1: null, slot2: null } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { state, fetcher };
};
const settle = () => new Promise<void>((r) => setTimeout(r, 20));
const opts = (fetcher: typeof fetch) => ({ base: '/origins', fetch: fetcher });

test('a signed-in swap persists across a fresh context: one write of the final pair, then an empty device reads the server copy', async () => {
  const w = writer(null);
  // context 1: signed in, a swap (Ground Slam into SPECIAL 1)
  useSpecialStore(mem()); pushSpecialSlotsOnPick(() => 'token', () => 'pc:1', opts(w.fetcher));
  assert.deepEqual(equippedSpecials(), ['cleave', 'reaping']);
  equipSpecial('stomp', 0); await settle();
  assert.deepEqual(w.state.calls.map((c) => [c.op, c.body.character, c.body.slot1, c.body.slot2]), [['special_slots_set', 'pc:1', 'stomp', null]], 'one write, both slots sent (a null slot is "the default")');
  equipSpecial('reaping', 0); await settle();   // a skill already in the other slot MOVES: still one write, the final pair
  assert.deepEqual(w.state.calls.at(-1)!.body, { character: 'pc:1', slot1: 'reaping', slot2: null });
  // context 2: a fresh browser (empty device cache), the same account
  useSpecialStore(mem()); useSpecialPush(undefined);
  assert.deepEqual(equippedSpecials(), ['cleave', 'reaping'], 'nothing on this device yet: the row defaults');
  assert.equal(await pullSpecialSlots('token', 'pc:1', opts(w.fetcher)), 'adopted');
  assert.deepEqual(equippedSpecials(), ['reaping', 'cleave'], 'the account\'s swap is in the buttons: Whirlwind in SPECIAL 1, SPECIAL 2 on its alternative');
  assert.equal(w.state.calls.filter((c) => c.op === 'special_slots_set').length, 2, 'adopting the server copy sends nothing back');
});

test('an account with nothing stored takes the device\'s picks up once; with none on the device nothing is sent', async () => {
  const w = writer({ slot1: null, slot2: null });
  useSpecialStore(mem()); useSpecialPush(undefined);
  assert.equal(await pullSpecialSlots('token', 'pc:1', opts(w.fetcher)), 'kept'); assert.deepEqual(w.state.calls.map((c) => c.op), ['special_slots_get']);
  equipSpecial('lunge', 1);
  assert.equal(await pullSpecialSlots('token', 'pc:1', opts(w.fetcher)), 'pushed');
  assert.deepEqual(w.state.row, { slot1: null, slot2: 'lunge' });
});

test('the server copy wins over a stale device cache; a dropped pick reads as the default', async () => {
  const w = writer({ slot1: 'stomp', slot2: 'lunge' });
  useSpecialStore(mem()); useSpecialPush(undefined); equipSpecial('reaping', 0);
  assert.equal(await pullSpecialSlots('token', 'pc:1', opts(w.fetcher)), 'adopted');
  assert.deepEqual(equippedSpecials(), ['stomp', 'lunge']);
  adoptSpecialSlots(['ironrush', 'lunge']);   // ironrush left the beta pick
  assert.deepEqual(equippedSpecials(), ['cleave', 'lunge'], 'a pick the cut dropped is no pick: SPECIAL 1 falls back to its default');
});

test('a 503 (migration not applied) or no session keeps the device pick; a guest page sends nothing', async () => {
  const down = writer(null, true);
  useSpecialStore(mem()); useSpecialPush(undefined); equipSpecial('stomp', 0);
  assert.equal(await pullSpecialSlots('token', 'pc:1', opts(down.fetcher)), 'kept'); assert.deepEqual(equippedSpecials(), ['stomp', 'reaping'], 'the device pick stands');
  assert.equal(await pullSpecialSlots(null, 'pc:1', opts(down.fetcher)), 'kept');
  const guest = writer(null); useSpecialStore(mem()); pushSpecialSlotsOnPick(() => null, () => 'pc:1', opts(guest.fetcher)); equipSpecial('lunge', 0); await settle();
  assert.equal(guest.state.calls.length, 0, 'signed out: no token, no call');
  useSpecialPush(undefined);
});
