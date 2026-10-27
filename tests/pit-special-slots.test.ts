// The Pit page's specials picker follows the account (src/main.ts wires src/core/special-sync.ts followAccountSlots the way the Zone 1 page does, #3430; Backend #3422): through the page's own character door
// (characterFor over `open`) and a fake writer, a signed-in Pit swap is one write of the final pair and persists across a fresh context; a guest sends nothing; a 503 keeps the device pick.
import './lib/era-off.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { characterFor } from '../src/core/open.ts';
import { equipSpecial, equippedSpecials, useSpecialPush, useSpecialStore } from '../src/core/special-equip.ts';
import { followAccountSlots } from '../src/core/special-sync.ts';
import { AUTH_KEY } from '../src/core/writer-call.ts';

type Row = { slot1: string | null; slot2: string | null };
const mem = (seed: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> => { const data = new Map(Object.entries(seed)); return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } }; };
const signedIn = () => mem({ [AUTH_KEY]: JSON.stringify({ access_token: 'tok', expires_at: Math.floor(Date.now() / 1000) + 3600 }) });
/** A tiny writer for one account: `open` names its character, special_slots_get / _set keep one row; `down` answers 503 to the slot ops (the migration not applied yet). */
const writer = (down = false) => {
  const state = { row: null as Row | null, calls: [] as { op: string; body: Record<string, unknown> }[] };
  const fetcher = (async (url: string, init: { body: string }) => {
    const op = String(url).split('/').pop() as string, body = JSON.parse(init.body || '{}') as Record<string, unknown>; state.calls.push({ op, body });
    if (op === 'open') return new Response(JSON.stringify({ ok: true, result: { characters: [{ id: 'pc:1' }] } }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (down) return new Response('{}', { status: 503 });
    if (op === 'special_slots_set') state.row = { slot1: (body.slot1 as string | null) ?? null, slot2: (body.slot2 as string | null) ?? null };
    return new Response(JSON.stringify({ ok: true, result: state.row ?? { slot1: null, slot2: null } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { state, fetcher };
};
const settle = () => new Promise<void>((r) => setTimeout(r, 30));
/** The Pit page's own wiring, as src/main.ts builds it: the token from the page's storage, the character through `open`. */
const wire = (storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, fetcher: typeof fetch) => {
  let id: string | null = null;
  const character = characterFor({ storage, search: '', fetch: fetcher, retries: 0 }, () => id, (found) => { id = found; });
  return followAccountSlots(() => (JSON.parse(storage.getItem(AUTH_KEY) ?? 'null') ? 'tok' : null), character, { base: '/origins', fetch: fetcher });
};
const specialOps = (w: ReturnType<typeof writer>) => w.state.calls.filter((c) => c.op.startsWith('special_slots'));

test('a signed-in Pit swap persists across a fresh context (fake writer)', async () => {
  const w = writer();
  // context 1: the Pit page signed in; a swap writes the final pair once
  useSpecialStore(mem()); const first = signedIn();
  assert.equal(await wire(first, w.fetcher), 'kept', 'nothing on the server and nothing on the device: nothing to take up');
  equipSpecial('stomp', 0); await settle();
  assert.deepEqual(specialOps(w).filter((c) => c.op === 'special_slots_set').map((c) => [c.body.character, c.body.slot1, c.body.slot2]), [['pc:1', 'stomp', null]], 'one write of the final pair, the character from the page\'s own `open`');
  // context 2: a fresh browser (empty device cache), the same account
  useSpecialPush(undefined); useSpecialStore(mem());
  assert.deepEqual(equippedSpecials(), ['cleave', 'reaping'], 'nothing on this device yet: the row defaults');
  assert.equal(await wire(signedIn(), w.fetcher), 'adopted');
  assert.deepEqual(equippedSpecials()[0], 'stomp', 'the Pit\'s picker reads the account\'s swap');
  useSpecialPush(undefined);
});

test('a guest Pit sends nothing and keeps its device pick', async () => {
  const w = writer();
  useSpecialStore(mem()); const guest = mem();
  assert.equal(await wire(guest, w.fetcher), 'kept');
  equipSpecial('stomp', 0); await settle();
  assert.deepEqual(w.state.calls, [], 'no token: not even an `open`, and no special op');
  assert.equal(equippedSpecials()[0], 'stomp');
  useSpecialPush(undefined);
});

test('a 503 (the migration not applied) keeps the device pick on the Pit page', async () => {
  const w = writer(true);
  useSpecialStore(mem()); equipSpecial('lunge', 1);
  assert.equal(await wire(signedIn(), w.fetcher), 'kept');
  assert.equal(equippedSpecials()[1], 'lunge', 'the pick the device made stands');
  equipSpecial('stomp', 0); await settle();
  assert.deepEqual(equippedSpecials(), ['stomp', 'lunge'], 'a failed write changes nothing on the device');
  useSpecialPush(undefined);
});

test('src/main.ts wires the Pit picker once, after the specials store opens', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const store = main.indexOf('useSpecialStore(localStorage)'), wired = main.indexOf('followAccountSlots(');
  assert.ok(store > 0 && wired > store, 'the account read adopts into an open store');
  assert.equal(main.split('followAccountSlots(').length - 1, 1, 'wired once');
});
