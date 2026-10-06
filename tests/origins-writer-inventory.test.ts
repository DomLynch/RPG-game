// The writer's inventory ops (origins/server/consume.ts) over real HTTP against a small in-memory stand-in for the database: origins_open,
// origins_event and origins_commit (event + burn ops with the database's own O0001 / O0002 refusals). No Postgres; the real cluster is
// scripts/origins-writer-check.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { DbError, type Db } from '../origins/server/db.ts';
import { createWriter } from '../origins/server/server.ts';
import { withContent } from '../origins/server/handlers.ts';
import { instanceOf } from '../origins/server/holdings.ts';
import type { Json } from '../origins/server/store.ts';
import { lookup } from '../origins/inventory/testkit.ts';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PC = 'pc:dom-1', SIBLING = 'pc:dom-2', OTHER = 'pc:bran-1', ORE = 'item:exchange-ore', RECORD = 'item:stolen-name-record';
const AT = '2026-10-06T12:00:00Z';
const row = (id: string, item: string, quantity: number, kind: 'pack' | 'bank', index: number, mint: string, over: Json = {}): Json => ({
  id, item, version: 1, quantity, tier: null, upgrade_level: 0, loc_kind: kind, loc_owner: PC, loc_index: index, loc_slot: null, bound_to: null, mint_key: mint,
  provenance: { kind: 'loot', mintKey: mint, at: AT, wonBy: PC, table: 'loottable:ghoul', encounter: 'encounter:ruin-vigil' }, history: [], holder_account: A, ...over,
});
const record = (): Json => row('inst:record-1', RECORD, 1, 'pack', 3, 'quest:stolen-name:ruin:dom-1', {
  bound_to: PC, provenance: { kind: 'quest-reward', mintKey: 'quest:stolen-name:ruin:dom-1', at: AT, wonBy: PC, quest: 'quest:stolen-name', stage: 'ruin' },
});

// The database, as far as these ops reach it. `eventHidden` hides a stored event from origins_event (a commit that lands after the read).
function fakeDb(items: Json[], hooks: { eventHidden?: () => boolean; stale?: boolean } = {}) {
  const events = new Map<string, Json>(), commits: Json[][] = [], calls: { fn: string; vars: Readonly<Record<string, string>> }[] = [];
  const characters = [{ id: PC, account: A, pack_slots: 8, bank_slots: 8 }, { id: SIBLING, account: A, pack_slots: 8, bank_slots: 8 }, { id: OTHER, account: B, pack_slots: 8, bank_slots: 8 }];
  const apply = (account: string, batch: Json[]): void => {
    const next = new Map(items.map(i => [i.id as string, { ...i }]));
    for (const op of batch) {
      if (op.op === 'event') {
        if (events.has(op.event_id as string)) throw new DbError('O0001', `event ${op.event_id} already settled`);
        events.set(op.event_id as string, { event_id: op.event_id, kind: op.kind, account: op.account, character: op.character, payload: op.payload });
      } else if (op.op === 'burn') {
        const r = next.get(op.id as string), n = op.count as number;
        if (!r || r.version !== op.expected_version || n < 1 || n > (r.quantity as number) || r.holder_account !== account || hooks.stale) throw new DbError('O0002', `burn of ${op.id} refused`);
        if (n === r.quantity) next.delete(r.id as string); else next.set(r.id as string, { ...r, quantity: (r.quantity as number) - n, version: (r.version as number) + 1 });
      } else throw new DbError('O0011', `unknown op ${op.op}`);
    }
    items = [...next.values()];
  };
  const db: Db = {
    async run(sql, vars = {}) {
      const fn = /origins_\w+/.exec(sql)![0];
      calls.push({ fn, vars });
      if (fn === 'origins_open') return JSON.stringify({ marks: 0, career: null, characters: characters.filter(c => c.account === vars.a), items: items.filter(i => i.holder_account === vars.a), quests: [], journal: [], talk: [] });
      if (fn === 'origins_event') { const e = events.get(vars.e); return e && e.account === vars.a && !hooks.eventHidden?.() ? JSON.stringify(e) : 'null'; }
      if (fn === 'origins_commit') {
        const batch = JSON.parse(vars.b) as Json[];
        const saved = new Map(events);
        try { apply(vars.a, batch); } catch (e) { events.clear(); for (const [k, v] of saved) events.set(k, v); throw e; }
        commits.push(batch);
        return '[]';
      }
      throw Error(`unscripted ${fn}`);
    },
  };
  return { db, calls, commits, events, items: () => items, race: (account: string, batch: Json[]) => apply(account, batch) };
}

async function serve(db: Db) {
  const server = createWriter({ db, verify: async t => (t === 'ta' ? A : t === 'tb' ? B : null), handlers: withContent({ lookup }) });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/origins/consume`;
  const call = async (body: Json, token = 'ta') => {
    const res = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as { ok: boolean; result?: Json & { replayed: boolean; burn: Json }; error?: string; code?: string } };
  };
  return { call, close: () => server.close() };
}
const handIn = (over: Json = {}): Json => ({ character: PC, op: 'quest:ore-handin:0001', reason: 'quest-handin', qty: 5, itemId: ORE, ...over });
const ores = () => [row('inst:ore-a', ORE, 3, 'pack', 0, 'loot:ruin-vigil:a'), row('inst:ore-b', ORE, 10, 'pack', 1, 'loot:ruin-vigil:b', { version: 4 }), row('inst:ore-c', ORE, 20, 'bank', 0, 'loot:ruin-vigil:c')];

test('consume: burns from the backpack, lowest slot first, as one batch of the burn event plus a burn per row at its version', async () => {
  const f = fakeDb(ores());
  const { call, close } = await serve(f.db);
  try {
    const res = await call(handIn());
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const lines = [{ instance: 'inst:ore-a', item: ORE, mintKey: 'loot:ruin-vigil:a', quantity: 3 }, { instance: 'inst:ore-b', item: ORE, mintKey: 'loot:ruin-vigil:b', quantity: 2 }];
    assert.deepEqual(res.body.result, { event: `burn:${PC}:quest:ore-handin:0001`, replayed: false, burn: { op: 'quest:ore-handin:0001', owner: PC, reason: 'quest-handin', asked: { qty: 5, itemId: ORE }, lines } });
    assert.deepEqual(f.commits, [[
      { op: 'event', event_id: `burn:${PC}:quest:ore-handin:0001`, kind: 'burn', account: A, character: PC, payload: { owner: PC, reason: 'quest-handin', asked: { qty: 5, itemId: ORE }, lines } },
      { op: 'burn', id: 'inst:ore-a', expected_version: 1, count: 3 }, { op: 'burn', id: 'inst:ore-b', expected_version: 4, count: 2 },
    ]]);
    assert.deepEqual(f.items().map(i => [i.id, i.quantity, i.version]), [['inst:ore-b', 8, 5], ['inst:ore-c', 20, 1]], 'the bank stack is never touched');
  } finally { close(); }
});

test('consume: an identical retry returns the original receipt and commits nothing; a different request under the op id is a 409', async () => {
  const f = fakeDb(ores());
  const { call, close } = await serve(f.db);
  try {
    const first = await call(handIn());
    const again = await call(handIn());
    assert.equal(again.status, 200);
    assert.deepEqual(again.body.result, { ...first.body.result, replayed: true });
    assert.equal(f.commits.length, 1, 'the retry wrote nothing');
    for (const other of [handIn({ qty: 4 }), handIn({ itemId: undefined, mintKey: 'loot:ruin-vigil:b' })]) {
      const res = await call(other);
      assert.deepEqual([res.status, res.body.code], [409, 'op-conflict'], JSON.stringify(other));
    }
    assert.deepEqual([f.commits.length, f.items().map(i => i.quantity)], [1, [8, 20]], 'nothing changed');
  } finally { close(); }
});

test('consume: a retry that races the first commit (O0001) answers from the stored event, or conflicts', async () => {
  for (const [qty, want] of [[5, 200], [4, 409]] as const) {
    let hidden = true;
    const f = fakeDb(ores(), { eventHidden: () => hidden });
    // The first request's batch lands between this request's read and its commit.
    f.db.run = (run => async (sql: string, vars?: Readonly<Record<string, string>>) => {
      if (sql.includes('origins_commit') && hidden) {
        f.race(A, [{ op: 'event', event_id: `burn:${PC}:quest:ore-handin:0001`, kind: 'burn', account: A, character: PC, payload: { owner: PC, reason: 'quest-handin', asked: { qty, itemId: ORE }, lines: [{ instance: 'inst:ore-a', item: ORE, mintKey: 'loot:ruin-vigil:a', quantity: 3 }, { instance: 'inst:ore-b', item: ORE, mintKey: 'loot:ruin-vigil:b', quantity: qty - 3 }] } },
          { op: 'burn', id: 'inst:ore-a', expected_version: 1, count: 3 }, { op: 'burn', id: 'inst:ore-b', expected_version: 4, count: qty - 3 }]);
        hidden = false;
      }
      return run(sql, vars);
    })(f.db.run.bind(f.db));
    const { call, close } = await serve(f.db);
    try {
      const res = await call(handIn());
      assert.equal(res.status, want, JSON.stringify(res.body));
      if (want === 200) assert.deepEqual([res.body.result!.replayed, (res.body.result!.burn as Json).asked], [true, { qty: 5, itemId: ORE }]);
      assert.equal(f.commits.length, 0, 'the losing commit wrote nothing');
    } finally { close(); }
  }
});

test('consume: an O0001 whose event cannot be read back is never answered as a burn', async () => {
  const f = fakeDb(ores(), { eventHidden: () => true });
  f.events.set(`burn:${PC}:quest:ore-handin:0001`, { event_id: `burn:${PC}:quest:ore-handin:0001`, kind: 'burn', account: A });
  const { call, close } = await serve(f.db);
  try {
    const res = await call(handIn());
    assert.deepEqual([res.status, res.body.code, res.body.ok], [409, 'O0001', false]);
    assert.equal(f.commits.length, 0);
  } finally { close(); }
});

test('consume refusals: short, bank-only, story piece, wrong reason, bad op id, another account\'s character; none commits', async () => {
  // A second character of the same account carries 50 ore: never this character's to hand in.
  const f = fakeDb([...ores(), record(), row('inst:ore-sib', ORE, 50, 'pack', 0, 'loot:ruin-vigil:sib', { loc_owner: SIBLING })]);
  const { call, close } = await serve(f.db);
  try {
    const cases: [Json, string][] = [
      [handIn({ qty: 14 }), 'qty: needs 14'],                                        // 13 in the pack; the 20 in the bank do not count
      [handIn({ itemId: undefined, mintKey: 'loot:ruin-vigil:c' }), 'backpack holds 0'],   // a bank-only stack is not handed in
      [handIn({ itemId: RECORD, qty: 1 }), 'story-critical'],                                // a story piece, not named by the step
      [handIn({ itemId: RECORD, qty: 1, consumesStoryItem: ORE }), 'consumesStoryItem'],
      [handIn({ reason: 'upgrade-cost' }), 'reason'],
      [handIn({ op: 'short' }), 'op'],
      [handIn({ op: `quest:${'x'.repeat(115)}` }), 'op: an operation id (8..120'],   // the pure module allows 128; the event id must fit 200
      [handIn({ character: OTHER }), 'character'],
      [handIn({ character: undefined }), 'character'],
      [handIn({ character: 7 }), 'character: a character id'],
      [handIn({ qty: 0 }), 'qty: burn a whole number'],
    ];
    for (const [body, path] of cases) {
      const res = await call(body);
      assert.equal(res.status, 400, `${JSON.stringify(body)} -> ${JSON.stringify(res.body)}`);
      assert.ok(res.body.error!.includes(path), `${JSON.stringify(body)} -> ${res.body.error}`);
    }
    assert.equal(f.commits.length, 0);
    assert.equal(f.calls.filter(c => c.fn === 'origins_commit').length, 0);
    // The story piece burns when the hand-in names it.
    const named = await call(handIn({ op: 'quest:stolen-name:ruin:handin', itemId: RECORD, qty: 1, consumesStoryItem: RECORD }));
    assert.equal(named.status, 200, JSON.stringify(named.body));
    assert.deepEqual(f.commits[0]!.slice(1), [{ op: 'burn', id: 'inst:record-1', expected_version: 1, count: 1 }]);
  } finally { close(); }
});

test('consume: the account is the token\'s; a body account is ignored, and a stale write is a clear 409', async () => {
  const f = fakeDb(ores());
  const { call, close } = await serve(f.db);
  try {
    const res = await call(handIn({ account: B }));
    assert.equal(res.status, 200);
    assert.ok(f.calls.every(c => c.vars.a === A), 'every database call is for the token\'s account');
    assert.equal(f.commits[0]![0]!.account, A);
    assert.equal((await call(handIn({ op: 'quest:ore-handin:0002' }), 'tb')).status, 400, 'B cannot spend A\'s character');
  } finally { close(); }
  const stale = fakeDb(ores(), { stale: true });
  const s = await serve(stale.db);
  try {
    const res = await s.call(handIn());
    assert.deepEqual([res.status, res.body.code, /open again/.test(res.body.error!)], [409, 'O0002', true]);
  } finally { s.close(); }
});

test('instanceOf: a split child counts by its own mint key; a row the contracts refuse is a server fault', () => {
  const child = instanceOf(row('inst:ore-s', ORE, 2, 'pack', 4, 'loot:ruin-vigil:a::s3', { provenance: row('x', ORE, 1, 'pack', 0, 'loot:ruin-vigil:a').provenance }) as never);
  assert.equal(child.provenance.mintKey, 'loot:ruin-vigil:a::s3');
  assert.deepEqual(child.location, { kind: 'pack', owner: PC, index: 4 });
  assert.throws(() => instanceOf(row('not-an-instance-id', ORE, 2, 'pack', 4, 'loot:x') as never), /does not parse/);
});
