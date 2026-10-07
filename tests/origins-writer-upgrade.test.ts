// The writer's smith (origins/server/upgrade.ts) over real HTTP against a small in-memory stand-in for the database: origins_open (items and the
// career row), origins_event and origins_commit (event + put + burn ops with the database's own O0001 / O0002 refusals). No Postgres; the real
// cluster is scripts/origins-writer-check.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import * as F from '../origins/contracts/fixtures.ts';
import { cumulative } from '../origins/progression/model.ts';
import { DbError, type Db } from '../origins/server/db.ts';
import { withContent } from '../origins/server/handlers.ts';
import { createWriter } from '../origins/server/server.ts';
import type { Json } from '../origins/server/store.ts';
import { smithContent, upgradeHandler } from '../origins/server/upgrade.ts';
import { lookup } from '../origins/inventory/testkit.ts';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PC = 'pc:dom-1', OTHER = 'pc:bran-1', IRON = 'item:grave-iron', HELM = 'item:loot.veteran.Helmet', RECORD = 'item:stolen-name-record';
const AT = '2026-10-06T12:00:00Z', NOW = '2026-10-06T13:00:00.000Z';
const OP = 'smith:helm-0001:l1';

const row = (id: string, item: string, quantity: number, kind: 'pack' | 'bank', index: number, mint: string, over: Json = {}): Json => ({
  id, item, version: 1, quantity, tier: null, upgrade_level: 0, loc_kind: kind, loc_owner: PC, loc_index: index, loc_slot: null, bound_to: null, mint_key: mint,
  provenance: { kind: 'loot', mintKey: mint, at: AT, wonBy: PC, table: 'loottable:ghoul', encounter: 'encounter:ruin-vigil' }, history: [], holder_account: A, ...over,
});
const helm = (over: Json = {}): Json => row('inst:helm-0001', HELM, 1, 'pack', 0, 'claim:1001', {
  tier: 'Recruit', version: 3, provenance: { kind: 'arena-award', mintKey: 'claim:1001', at: AT, claimId: 1001, lootId: 'veteran.Helmet', wonBy: PC, fromLegend: 'veteran-1', atRank: 'Recruit' }, ...over,
});
const theirs = (): Json => helm({ id: 'inst:helm-bran', loc_owner: OTHER, holder_account: B, mint_key: 'claim:2001', provenance: { kind: 'arena-award', mintKey: 'claim:2001', at: AT, claimId: 2001, lootId: 'veteran.Helmet', wonBy: OTHER, fromLegend: 'veteran-1', atRank: 'Recruit' } });
const record = (): Json => row('inst:record-1', RECORD, 1, 'pack', 3, 'quest:stolen-name:ruin:dom-1', {
  bound_to: PC, provenance: { kind: 'quest-reward', mintKey: 'quest:stolen-name:ruin:dom-1', at: AT, wonBy: PC, quest: 'quest:stolen-name', stage: 'ruin' },
});
const irons = () => [row('inst:iron-a', IRON, 3, 'pack', 1, 'loot:ruin-vigil:a'), row('inst:iron-b', IRON, 10, 'pack', 2, 'loot:ruin-vigil:b', { version: 4 }), row('inst:iron-c', IRON, 20, 'bank', 0, 'loot:ruin-vigil:c')];

// Materials only: level 1 costs 5 grave iron and 0 coin; level 2 still carries a coin price (refused 501 until the metals ledger).
const costs = (rows = [{ level: 1, rarity: 'common', coin: 0, materials: [{ item: IRON, quantity: 5 }] }, { level: 2, rarity: 'common', coin: 250, materials: [] }]) => ({ ...F.forgeCosts(), rows });
const CONTENT = { lookup, smith: smithContent(F.blacksmith(), costs()) };

// The database, as far as these ops reach it. `eventHidden` hides a stored event from origins_event (a commit that lands after the read).
function fakeDb(items: Json[], hooks: { eventHidden?: () => boolean; stale?: boolean; credit?: number } = {}) {
  const events = new Map<string, Json>(), commits: Json[][] = [], calls: { fn: string; vars: Readonly<Record<string, string>> }[] = [];
  const characters = [{ id: PC, account: A, pack_slots: 8, bank_slots: 8 }, { id: OTHER, account: B, pack_slots: 8, bank_slots: 8 }];
  const career = { seed_credit: 0, world_credit: 0, total_credit: hooks.credit ?? cumulative(11), rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 1 };
  const apply = (account: string, batch: Json[]): void => {
    const next = new Map(items.map(i => [i.id as string, { ...i }]));
    for (const op of batch) {
      const r = next.get(op.id as string);
      if (op.op === 'event') {
        if (events.has(op.event_id as string)) throw new DbError('O0001', `event ${op.event_id} already settled`);
        events.set(op.event_id as string, { event_id: op.event_id, kind: op.kind, account: op.account, character: op.character, payload: JSON.parse(JSON.stringify(op.payload)) });
      } else if (op.op === 'put') {
        if (!r || r.version !== op.expected_version || r.holder_account !== account || hooks.stale) throw new DbError('O0002', `item ${op.id} is stale or unknown`);
        const l = op.loc as Json;
        next.set(r.id as string, {
          ...r, version: (r.version as number) + 1, loc_kind: l.kind, loc_owner: l.owner, loc_index: l.index ?? null, loc_slot: l.slot ?? null,
          bound_to: op.bound_to, upgrade_level: op.upgrade_level ?? r.upgrade_level, history: [...(r.history as Json[]), ...(op.history_append as Json[])],
        });
      } else if (op.op === 'burn') {
        const n = op.count as number;
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
      if (fn === 'origins_open') return JSON.stringify({ marks: 0, career, characters: characters.filter(c => c.account === vars.a), items: items.filter(i => i.holder_account === vars.a), quests: [], journal: [], talk: [] });
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

async function serve(db: Db, content: typeof CONTENT = CONTENT) {
  const server = createWriter({ db, verify: async t => (t === 'ta' ? A : t === 'tb' ? B : null), handlers: { ...withContent(content), apply_upgrade: upgradeHandler(content, () => NOW) } });   // a fixed clock for the receipt's `at`
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/origins/apply_upgrade`;
  const call = async (body: Json, token = 'ta') => {
    const res = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as { ok: boolean; result?: Json & { replayed: boolean; receipt: Json }; error?: string; code?: string } };
  };
  return { call, close: () => server.close() };
}
const ask = (over: Json = {}): Json => ({ character: PC, op: OP, instance: 'inst:helm-0001', toLevel: 1, materials: ['inst:iron-a', 'inst:iron-b'], ...over });
const RECEIPT = {
  kind: 'upgrade-receipt', schemaVersion: 1, idempotencyKey: OP, character: PC, service: 'service:exchange-forge', smith: 'character:smith-orla', costTable: 'costtable:forge',
  costRevision: 1, instance: 'inst:helm-0001', fromLevel: 0, toLevel: 1, coin: 0,
  materials: [{ instance: 'inst:iron-a', item: IRON, quantity: 3 }, { instance: 'inst:iron-b', item: IRON, quantity: 2 }], at: NOW,
};
const ENTRY = { kind: 'upgrade', smith: 'character:smith-orla', level: 1, receipt: OP, at: NOW };

test('apply_upgrade: one batch of the upgrade event, the piece\'s level + history put at its version, and a burn per material row', async () => {
  const f = fakeDb([helm(), ...irons()]);
  const { call, close } = await serve(f.db);
  try {
    const res = await call(ask());
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.result, { event: `upgrade:${PC}:${OP}`, replayed: false, receipt: RECEIPT });
    assert.deepEqual(f.commits, [[
      { op: 'event', event_id: `upgrade:${PC}:${OP}`, kind: 'upgrade', account: A, character: PC, payload: { receipt: RECEIPT } },
      { op: 'put', id: 'inst:helm-0001', expected_version: 3, loc: { kind: 'pack', owner: PC, index: 0 }, bound_to: null, upgrade_level: 1, history_append: [ENTRY] },
      { op: 'burn', id: 'inst:iron-a', expected_version: 1, count: 3 }, { op: 'burn', id: 'inst:iron-b', expected_version: 4, count: 2 },
    ]]);
    assert.deepEqual(f.items().map(i => [i.id, i.quantity, i.version, i.upgrade_level]), [['inst:helm-0001', 1, 4, 1], ['inst:iron-b', 8, 5, 0], ['inst:iron-c', 20, 1, 0]]);
    assert.deepEqual(f.items()[0]!.history, [ENTRY]);
  } finally { close(); }
});

test('apply_upgrade: an identical retry returns the original receipt and commits nothing; a different request under the op id is a 409', async () => {
  const f = fakeDb([helm(), ...irons()]);
  const { call, close } = await serve(f.db);
  try {
    const first = await call(ask());
    const again = await call(ask());
    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.deepEqual(again.body.result, { ...first.body.result, replayed: true });
    assert.equal(JSON.stringify(again.body.result!.receipt), JSON.stringify(first.body.result!.receipt), 'the very same bytes, whatever order jsonb kept');
    assert.equal(f.commits.length, 1, 'the retry wrote nothing');
    const res = await call(ask({ toLevel: 2 }));
    assert.deepEqual([res.status, res.body.code], [409, 'op-conflict'], JSON.stringify(res.body));
    assert.equal(f.commits.length, 1);
  } finally { close(); }
});

test('apply_upgrade: a retry that races the first commit (O0001) answers from the stored receipt; an unreadable one stays a 409', async () => {
  let hidden = true;
  const f = fakeDb([helm(), ...irons()], { eventHidden: () => hidden });
  f.db.run = (run => async (sql: string, vars?: Readonly<Record<string, string>>) => {
    if (sql.includes('origins_commit') && hidden) {   // the first request's batch lands between this request's read and its commit
      f.race(A, [{ op: 'event', event_id: `upgrade:${PC}:${OP}`, kind: 'upgrade', account: A, character: PC, payload: { receipt: RECEIPT } },
        { op: 'put', id: 'inst:helm-0001', expected_version: 3, loc: { kind: 'pack', owner: PC, index: 0 }, bound_to: null, upgrade_level: 1, history_append: [ENTRY] }]);
      hidden = false;
    }
    return run(sql, vars);
  })(f.db.run.bind(f.db));
  const { call, close } = await serve(f.db);
  try {
    const res = await call(ask());
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual([res.body.result!.replayed, res.body.result!.receipt], [true, RECEIPT]);
    assert.equal(f.commits.length, 0, 'the losing commit wrote nothing');
  } finally { close(); }
  const g = fakeDb([helm(), ...irons()], { eventHidden: () => true });
  g.events.set(`upgrade:${PC}:${OP}`, { event_id: `upgrade:${PC}:${OP}`, kind: 'upgrade', account: A });
  const s = await serve(g.db);
  try {
    const res = await s.call(ask());
    assert.deepEqual([res.status, res.body.code], [409, 'O0001'], 'never answered as an upgrade');
    assert.equal(g.commits.length, 0);
  } finally { s.close(); }
});

test('apply_upgrade: a cost row that charges coin is a 501 (no metals ledger); the content takes coin 0 at the contracts\' bound', async () => {
  const f = fakeDb([helm({ upgrade_level: 1 }), ...irons()]);
  const { call, close } = await serve(f.db);
  try {
    const res = await call(ask({ op: 'smith:helm-0001:l2', toLevel: 2, materials: [], coin: 999, balance: 999 }));   // a balance in the body is not a balance
    assert.deepEqual([res.status, res.body.code], [501, 'not-implemented'], JSON.stringify(res.body));
    assert.match(res.body.error!, /coin costs need the metals ledger, not built yet/);
    assert.equal(f.calls.filter(c => c.fn === 'origins_commit').length, 0);
  } finally { close(); }
  assert.throws(() => smithContent(F.blacksmith(), costs([{ level: 1, rarity: 'common', coin: -1, materials: [] }])), /coin/, 'below the contracts\' lower bound');
  const none = await serve(fakeDb([helm()]).db, { lookup } as typeof CONTENT);
  try { assert.equal((await none.call(ask())).status, 501, 'no smith in this content'); } finally { none.close(); }
});

test('apply_upgrade: bank materials only at the Exchange', async () => {
  const f = fakeDb([helm(), ...irons()]);
  const { call, close } = await serve(f.db);
  try {
    for (const place of [undefined, 'region:ash-frontier']) {
      const res = await call(ask({ materials: ['inst:iron-c'], place }));
      assert.equal(res.status, 400, JSON.stringify(res.body));
      assert.match(res.body.error!, place ? /place/ : /the bank opens only at the Concord Exchange/);
    }
    assert.equal(f.commits.length, 0);
    const res = await call(ask({ materials: ['inst:iron-c'], place: 'exchange' }));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(f.commits[0]!.slice(2), [{ op: 'burn', id: 'inst:iron-c', expected_version: 1, count: 5 }]);
  } finally { close(); }
});

test('apply_upgrade: another account\'s piece or character is refused; the account is the token\'s', async () => {
  const f = fakeDb([helm(), ...irons(), theirs()]);
  const { call, close } = await serve(f.db);
  try {
    const cases: [Json, string, string?][] = [
      [ask({ instance: 'inst:helm-bran' }), 'instance: not one of this character'],
      [ask({ character: OTHER }), 'character: not one of this account'],
      [ask({ op: 'smith:x:0002' }), 'character: not one of this account', 'tb'],   // B's token cannot spend A's character
      [ask({ materials: ['inst:iron-a', 'inst:helm-bran'] }), 'materials[1]'],
    ];
    for (const [body, text, token] of cases) {
      const res = await call(body, token);
      assert.equal(res.status, 400, `${JSON.stringify(body)} -> ${JSON.stringify(res.body)}`);
      assert.ok(res.body.error!.includes(text), `${JSON.stringify(body)} -> ${res.body.error}`);
    }
    assert.equal(f.commits.length, 0);
    const from = f.calls.length;
    assert.equal((await call(ask({ account: B }))).status, 200);
    assert.ok(f.calls.slice(from).every(c => c.vars.a === A), 'every database call is for the token\'s account, whatever the body says');
    assert.equal(f.commits[0]![0]!.account, A);
  } finally { close(); }
});

test('apply_upgrade: a cost, level, amount or outcome in the body is ignored; the server derives the receipt', async () => {
  const f = fakeDb([helm(), ...irons()]);
  const { call, close } = await serve(f.db);
  try {
    const res = await call(ask({ coin: 999, cost: { coin: 0, materials: [] }, fromLevel: 8, upgradeLevel: 9, expectedVersion: 0, quantity: 1, receipt: { coin: 0, materials: [] }, outcome: { replayed: true } }));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.result!.receipt, RECEIPT);
    assert.equal((f.commits[0]![1] as Json).upgrade_level, 1);
  } finally { close(); }
});

test('apply_upgrade refusals: short materials, a skipped level, rank, a story piece, bad fields, stale; none commits', async () => {
  const f = fakeDb([helm(), ...irons(), record()]);
  const story = { lookup, smith: smithContent(F.blacksmith(), costs([{ level: 1, rarity: 'common', coin: 0, materials: [{ item: RECORD, quantity: 1 }] }])) };
  const { call, close } = await serve(f.db);
  try {
    const cases: [Json, string][] = [
      [ask({ materials: ['inst:iron-a'] }), 'needs 5'],
      [ask({ materials: undefined }), 'needs 5'],
      [ask({ toLevel: 2 }), 'one level at a time'],
      [ask({ materials: ['inst:iron-a', 'inst:iron-a'] }), 'offered twice'],
      [ask({ materials: 'inst:iron-a' }), 'materials: a list'],
      [ask({ op: 'short' }), 'idempotencyKey'],
      [ask({ op: `smith:${'x'.repeat(115)}` }), 'op: an operation id (8..120'],
      [ask({ character: 7 }), 'character: a character id'],
      [ask({ toLevel: 'one' }), 'toLevel'],
    ];
    for (const [body, text] of cases) {
      const res = await call(body);
      assert.equal(res.status, 400, `${JSON.stringify(body)} -> ${JSON.stringify(res.body)}`);
      assert.ok(res.body.error!.includes(text), `${JSON.stringify(body)} -> ${res.body.error}`);
    }
  } finally { close(); }
  const low = await serve(fakeDb([helm(), ...irons()], { credit: 0 }).db);
  try { assert.match((await low.call(ask())).body.error!, /would need rank Legionary/); } finally { low.close(); }
  const s = await serve(f.db, story);
  try {
    const res = await s.call(ask({ materials: ['inst:record-1'] }));
    assert.deepEqual([res.status, /story-critical/.test(res.body.error!)], [400, true], JSON.stringify(res.body));
  } finally { s.close(); }
  assert.equal(f.commits.length, 0);
  const stale = await serve(fakeDb([helm(), ...irons()], { stale: true }).db);
  try {
    const res = await stale.call(ask());
    assert.deepEqual([res.status, res.body.code, /open again/.test(res.body.error!)], [409, 'O0002', true]);
  } finally { stale.close(); }
});
