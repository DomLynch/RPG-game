// Launch gate X2 Stage 2, the writer half (origins/server/location.ts): the saved location of an account's active character, written only from presence's
// observation through a key + loopback internal route, and served back with Strategy's rejoin rules. The real-Postgres run is scripts/origins-writer-check.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Db } from '../origins/server/db.ts';
import { createWriter } from '../origins/server/server.ts';
import { fakeWhere } from '../origins/presence/fixtures.ts';
import { REJOIN_EDGE, inTradeArea, noServerHeldState, parseServed, serve, writerSaveLocation, writerSavedLocation, type HeldFn } from '../origins/server/location.ts';
import { zoneAt } from '../origins/presence/zones.ts';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const KEY = 'test-writer-internal-key-0123456789';
const PIT = { x: 15000, z: 16000 }, EXCHANGE = { x: 15000, z: 11000 };   // world (0, +10 m) is the Pit yard; world (0, -40 m) is inside the Exchange (where.test.ts)
const row = (at: { x: number; z: number }) => ({ character: 'pc:a1', zone: zoneAt(at.x, at.z), x: at.x, z: at.z, updated_at: '2026-10-07T00:00:00Z' });

test('location: the rejoin edge is outside the Exchange, 50 cm from its outer gate on the Pit side', () => {
  assert.equal(zoneAt(PIT.x, PIT.z), 'pit-yard');
  assert.equal(zoneAt(EXCHANGE.x, EXCHANGE.z), 'exchange');
  assert.equal(inTradeArea(EXCHANGE.x, EXCHANGE.z), true, 'the whole exchange zone is the trade area');
  assert.equal(inTradeArea(REJOIN_EDGE.x, REJOIN_EDGE.z), false, 'the edge is not in it');
  assert.notEqual(zoneAt(REJOIN_EDGE.x, REJOIN_EDGE.z), 'exchange');
  assert.equal(inTradeArea(REJOIN_EDGE.x, REJOIN_EDGE.z - 51), true, 'one step back through the gate is inside: the edge hugs the gate');
});

test('location: serve applies the rejoin rules', () => {
  assert.deepEqual(serve(null, null), { saved: false }, 'nothing saved: none (presence uses its default spawn)');
  assert.deepEqual(serve(row(PIT), null), { saved: true, zone: 'pit-yard', x: PIT.x, z: PIT.z, source: 'saved' }, 'a Pit spot is served as saved');
  const ex = serve(row(EXCHANGE), null);
  assert.deepEqual(ex, { saved: true, zone: zoneAt(REJOIN_EDGE.x, REJOIN_EDGE.z), x: REJOIN_EDGE.x, z: REJOIN_EDGE.z, source: 'trade-edge' }, 'an Exchange spot is served at the gate edge');
  assert.deepEqual(serve({ ...row(PIT), zone: 'exchange' }, null), ex, 'a row stored as exchange moves to the edge too');
  // Strategy's rule (a): the writer holds no jail/bounty/feud/duel state today, so the seam answers null; a held state, once it exists, wins over the saved spot.
  const jail = { zone: 'pit-yard', x: 14000, z: 14000, reason: 'jail' as const };
  assert.deepEqual(serve(row(EXCHANGE), jail), { saved: true, zone: 'pit-yard', x: 14000, z: 14000, source: 'jail' }, 'a held state overrides the saved spot');
  assert.deepEqual(serve(null, jail), { saved: true, zone: 'pit-yard', x: 14000, z: 14000, source: 'jail' }, 'and applies with nothing saved: it never expires with the saved row');
});

test('location: no logout escape is a seam today: the default held-state lookup answers null for everyone', async () => {
  const db: Db = { run: async () => { throw Error('the default seam must not query anything'); } };
  assert.equal(await noServerHeldState(db, A, 'pc:a1'), null);
});

// A fake Db for the route: records the saved-location calls.
function fakeDb() {
  const saved = new Map<string, ReturnType<typeof row>>(), calls: { sql: string; vars: Readonly<Record<string, string>> }[] = [];
  const db: Db = {
    async run(sql, vars = {}) {
      calls.push({ sql, vars });
      if (sql.includes('origins_save_location')) { saved.set(vars.a, { character: 'pc:a1', zone: vars.zone || null, x: Number(vars.x), z: Number(vars.z), updated_at: vars.t }); return JSON.stringify({ character: 'pc:a1', stored: true }); }
      if (sql.includes('origins_saved_location')) return JSON.stringify(saved.get(vars.a) ?? null);
      if (sql.includes('origins_active(')) return saved.has(vars.a) ? 'pc:a1' : '';
      throw Error(`unscripted ${sql}`);
    },
  };
  return { db, calls };
}
async function start(db: Db, internal?: { key: string; held?: HeldFn }) {
  const server = createWriter({ db, verify: async () => null, where: fakeWhere({}), ...(internal ? { internal: { ...internal, now: () => 1_791_000_000_000 } } : {}) });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

test('location: the internal route needs the key, stores what presence saw, and serves it back', async () => {
  const f = fakeDb(), { server, base } = await start(f.db, { key: KEY });
  try {
    const post = (body: unknown, auth?: string) => fetch(`${base}/internal/location`, { method: 'POST', headers: auth ? { authorization: auth } : {}, body: JSON.stringify(body) });
    assert.equal((await post({ account: A, ...PIT })).status, 401, 'no key');
    assert.equal((await post({ account: A, ...PIT }, 'Bearer nope')).status, 401, 'a wrong key');
    assert.equal((await post({ account: A, ...PIT }, `Bearer ${KEY}x`)).status, 401, 'the key plus more');
    assert.equal((await post({ account: A, ...PIT }, KEY)).status, 401, 'the bare key without Bearer');
    assert.equal((await fetch(`${base}/internal/location?account=${A}`)).status, 401, 'the read needs the key too');
    assert.equal(f.calls.length, 0, 'a refusal touches nothing');
    for (const bad of [{ account: 'x', ...PIT }, { account: A, x: 1.5, z: 0 }, { account: A, x: -1, z: 0 }, { account: A, x: 0, z: 30001 }, { account: A, x: 0 }, { account: A, ...PIT, at: 'now' }])
      assert.equal((await post(bad, `Bearer ${KEY}`)).status, 400, JSON.stringify(bad));
    const save = writerSaveLocation(base, KEY), read = writerSavedLocation(base, KEY);
    assert.deepEqual(await read(A), { saved: false }, 'nothing saved yet');
    assert.deepEqual(await save(A, { ...EXCHANGE, atMs: 1_790_000_000_000 }), { character: 'pc:a1', stored: true });
    const stored = f.calls.find(c => c.sql.includes('origins_save_location'))!.vars;
    assert.deepEqual([stored.zone, stored.x, stored.z, stored.t], ['exchange', String(EXCHANGE.x), String(EXCHANGE.z), '1790000000000'], 'the zone is the writer\'s own computation from x, z');
    await post({ account: A, ...PIT, zone: 'exchange' }, `Bearer ${KEY}`);
    assert.equal(f.calls.filter(c => c.sql.includes('origins_save_location')).at(-1)!.vars.zone, 'pit-yard', 'a zone field in the post is ignored');
    assert.equal(f.calls.filter(c => c.sql.includes('origins_save_location')).at(-1)!.vars.t, '1791000000000', 'no `at`: the writer\'s clock');
    assert.deepEqual(await read(A), { saved: true, zone: 'pit-yard', x: PIT.x, z: PIT.z, source: 'saved' });
    await save(A, { ...EXCHANGE, atMs: 1_791_000_000_001 });
    assert.deepEqual(await read(A), { saved: true, zone: zoneAt(REJOIN_EDGE.x, REJOIN_EDGE.z), x: REJOIN_EDGE.x, z: REJOIN_EDGE.z, source: 'trade-edge' }, 'an Exchange spot is served at the edge');
    await assert.rejects(writerSavedLocation(base, 'wrong')(A), /HTTP 401/, 'the client turns a refusal into an error (presence then uses its default spawn)');
    assert.equal((await fetch(`${base}/internal/where?account=${A}`, { headers: { authorization: `Bearer ${KEY}` } })).status, 404, 'only /internal/location exists');
    assert.equal((await fetch(`${base}/internal/location?account=${A}`, { method: 'PUT', headers: { authorization: `Bearer ${KEY}` } })).status, 404, 'GET and POST only');
  } finally { server.close(); }
});

test('location: a held state from the seam overrides what is saved', async () => {
  const f = fakeDb(), held: HeldFn = async () => ({ zone: 'pit-yard', x: 100, z: 200, reason: 'duel' });
  const { server, base } = await start(f.db, { key: KEY, held });
  try {
    await writerSaveLocation(base, KEY)(A, { ...PIT, atMs: 1 });
    assert.deepEqual(await writerSavedLocation(base, KEY)(A), { saved: true, zone: 'pit-yard', x: 100, z: 200, source: 'duel' });
  } finally { server.close(); }
});

test('location: without a configured key the internal routes do not exist; client ops never reach them', async () => {
  const f = fakeDb(), { server, base } = await start(f.db);
  try {
    assert.equal((await fetch(`${base}/internal/location?account=${A}`, { headers: { authorization: `Bearer ${KEY}` } })).status, 404);
    assert.equal((await fetch(`${base}/internal/location`, { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: JSON.stringify({ account: A, ...PIT }) })).status, 404);
    assert.equal((await fetch(`${base}/origins/save_location`, { method: 'POST', headers: { authorization: 'Bearer tok' }, body: JSON.stringify({ ...PIT }) })).status, 404, 'no client op writes a location');
    assert.equal(f.calls.length, 0);
  } finally { server.close(); }
});

test('location: the presence-side parser fails closed', () => {
  for (const bad of [null, 7, {}, { saved: 'yes' }, { saved: true, x: 1, z: 1, zone: 3, source: 'saved' }, { saved: true, x: -1, z: 1, zone: null, source: 'saved' }, { saved: true, x: 1, z: 1, zone: null }])
    assert.throws(() => parseServed(bad), /malformed/, JSON.stringify(bad));
  assert.deepEqual(parseServed({ saved: false }), { saved: false });
});
