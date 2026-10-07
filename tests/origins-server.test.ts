import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { DbError, type Db } from '../origins/server/db.ts';
import { createWriter } from '../origins/server/server.ts';
import { fakeWhere } from '../origins/presence/fixtures.ts';
import { Refused } from '../origins/server/errors.ts';
import { BadRequest, handlers, openAccount, type Ctx, type Handler } from '../origins/server/handlers.ts';
import { pitBatch } from '../origins/server/career.ts';
import type { CareerRow, PitClaim, Snapshot } from '../origins/server/store.ts';
import { creditFromMarks, legendKey, levelOfCredit } from '../origins/progression/model.ts';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const row = (over: Partial<CareerRow> = {}): CareerRow => ({ seed_credit: 5000, world_credit: 0, total_credit: 5000, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 3, ...over });
const claim = (id: number, opponent = 'knight'): PitClaim => ({ claim_id: id, opponent, record: 'r', piece: null, tier: null, at: '2026-10-06T10:00:00Z' });

// A scripted Db: answers each migration function by name and records every call.
function script(replies: { open: () => Snapshot[]; pending?: PitClaim[]; snapshot?: () => string; commit?: (batch: unknown[]) => unknown }) {
  const calls: { fn: string; vars: Readonly<Record<string, string>> }[] = [];
  const opens = replies.open();
  let n = 0;
  const db: Db = {
    async run(sql, vars = {}) {
      // A statement pair is answered in order, like psql: the first refusal throws before the second runs.
      const answers: string[] = [];
      for (const fn of [...sql.matchAll(/public\.(origins_\w+)\(/g)].map(m => m[1])) {
        calls.push({ fn, vars });
        if (fn === 'origins_open') answers.push(JSON.stringify(opens[Math.min(n++, opens.length - 1)]));
        else if (fn === 'origins_snapshot') answers.push(replies.snapshot ? replies.snapshot() : '');
        else if (fn === 'origins_pit_pending') answers.push(JSON.stringify((replies.pending ?? []).slice(0, Number(vars.n ?? Infinity))));
        else if (fn === 'origins_commit') answers.push(JSON.stringify(replies.commit ? replies.commit(JSON.parse(vars.b)) : []));
        else if (fn === 'origins_create_character') answers.push('pc:abc');
        else throw Error(`unscripted ${fn}`);
      }
      return answers.join('\n');
    },
  };
  return { db, calls };
}
const snap = (career: CareerRow | null, marks = 4): Snapshot => ({ marks, career, characters: [], items: [], quests: [], journal: [], talk: [] });

async function serve(db: Db, ops?: Record<string, Handler>) {
  const server = createWriter({ db, verify: async t => (t === 'tok' ? A : null), where: fakeWhere({}), ...(ops ? { handlers: ops } : {}) });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/origins/`;
  const call = async (op: string, init: RequestInit & { token?: string | null } = {}) => {
    const { token = 'tok', ...rest } = init;
    const res = await fetch(url + op, { method: 'POST', ...rest, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) } });
    const text = await res.text();
    return { status: res.status, text, body: JSON.parse(text) as { ok: boolean; result?: unknown; error?: string } };
  };
  return { call, close: () => server.close() };
}

test('the writer routes: no or bad token is 401, an unknown op or a GET is 404, bad bodies are 400', async () => {
  const { db } = script({ open: () => [snap(row())] });
  const { call, close } = await serve(db);
  try {
    assert.equal((await call('open', { token: null, body: '{}' })).status, 401);
    assert.equal((await call('open', { token: 'nobody', body: '{}' })).status, 401);
    assert.equal((await call('nope', { body: '{}' })).status, 404);
    assert.equal((await call('open', { method: 'GET' })).status, 404);
    assert.equal((await call('open', { body: 'not json' })).status, 400);
    assert.equal((await call('open', { body: '[1]' })).status, 400);
    const big = await call('open', { body: JSON.stringify({ pad: 'x'.repeat(70 * 1024) }) });
    assert.deepEqual([big.status, big.body.error], [400, 'body too large']);
    assert.equal((await call('open', { body: '{}' })).status, 200);
  } finally { close(); }
});

test('the account is the token\'s, never the body\'s', async () => {
  const { db, calls } = script({ open: () => [snap(row())] });
  const { call, close } = await serve(db);
  try {
    const res = await call('create_character', { body: JSON.stringify({ name: 'Aldren', account: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }) });
    assert.deepEqual([res.status, res.body.result], [200, { id: 'pc:abc' }]);
    assert.equal(calls.at(-1)!.vars.a, A);
  } finally { close(); }
});

test('database refusals map to statuses and a failure is a fixed 500', async () => {
  const codes: Record<string, number> = { O0007: 403, O0008: 409, O0002: 409, '23505': 409 };
  for (const [code, status] of Object.entries(codes)) {
    const { call, close } = await serve({ run: async () => { throw new DbError(code, 'duplicate key value violates unique constraint "origins_characters_account_name_key"'); } });
    try {
      const res = await call('open', { body: '{}' });
      assert.equal(res.status, status, code);
      if (code === '23505') assert.equal(JSON.stringify(res.body).includes('origins_characters'), false, 'no constraint name leaks');
    } finally { close(); }
  }
  const { call, close } = await serve({ run: async () => { throw Error('secret detail'); } });
  try {
    const res = await call('open', { body: '{}' });
    assert.deepEqual([res.status, JSON.stringify(res.body).includes('secret')], [500, false]);
  } finally { close(); }
});

test('a Refused answers its status, with its code in the body only when it has one (the smith\'s 501; the story ops\' 503 carries none)', async () => {
  const { db } = script({ open: () => [snap(row())] });
  const { call, close } = await serve(db, {
    smith: async () => { throw new Refused(501, 'coin costs need the metals ledger, not built yet', 'not-implemented'); },
    story: async () => { throw new Refused(503, 'the story content is not loaded: the writer is not ready for this op'); },
  });
  try {
    assert.deepEqual([(await call('smith', { body: '{}' })).status, (await call('smith', { body: '{}' })).text], [501, '{"ok":false,"error":"coin costs need the metals ledger, not built yet","code":"not-implemented"}']);
    assert.deepEqual([(await call('story', { body: '{}' })).status, (await call('story', { body: '{}' })).text], [503, '{"ok":false,"error":"the story content is not loaded: the writer is not ready for this op"}']);
  } finally { close(); }
});

test('create_character name rules', async () => {
  const ctx: Ctx = { db: script({ open: () => [snap(row())] }).db, account: A };
  for (const name of ['', ' x', 'x ', 'x'.repeat(33), 'a\nb', 'a\u007fb', 7, undefined, null]) await assert.rejects(handlers.create_character(ctx, { name }), BadRequest, JSON.stringify(name));
  for (const name of ['A', 'x'.repeat(32), 'Æthelflæd', '名前']) assert.deepEqual(await handlers.create_character(ctx, { name }), { id: 'pc:abc' }, name);
});

test('pitBatch: a first win is an event plus a career_set at the row\'s version; a repeat is a cp 0 event only', () => {
  const level = levelOfCredit(5000);
  const won = pitBatch(A, row(), claim(7));
  assert.equal(won.reason, 'ok');
  assert.equal(won.batch.length, 2);
  assert.deepEqual(won.batch[0], { op: 'event', event_id: 'pit:7', kind: 'pit', account: A, payload: { cp: won.cp, legend: legendKey('knight', level), reason: 'ok' } });
  assert.ok(won.cp > 0);
  assert.equal(won.batch[1].op, 'career_set');
  assert.equal(won.batch[1].expected_version, 3);
  assert.deepEqual(won.batch[1].beaten, [legendKey('knight', level)]);
  const again = pitBatch(A, row({ beaten: [legendKey('knight', level)] }), claim(8));
  assert.deepEqual([again.reason, again.cp, again.batch.map(o => o.op)], ['already-beaten', 0, ['event']]);
});

test('openAccount: the first open snapshots once from the marks, a moved-marks refusal re-reads, a lost race is swallowed', async () => {
  const first = script({ open: () => [snap(null, 4), snap(row())] });
  await openAccount({ db: first.db, account: A });
  const snaps = first.calls.filter(c => c.fn === 'origins_snapshot');
  assert.deepEqual(snaps.map(c => [c.vars.m, c.vars.c]), [['4', String(creditFromMarks(4))]]);
  const settled = script({ open: () => [snap(row())] });
  await openAccount({ db: settled.db, account: A });
  assert.equal(settled.calls.filter(c => c.fn === 'origins_snapshot').length, 0, 'a snapshotted account is never snapshotted again');

  const moved = script({ open: () => [snap(null), snap(row())], snapshot: () => { throw new DbError('O0002', 'marks moved'); } });
  assert.ok((await openAccount({ db: moved.db, account: A })).career);
  const stuck = script({ open: () => [snap(null)], snapshot: () => { throw new DbError('O0002', 'marks moved'); } });
  await assert.rejects(openAccount({ db: stuck.db, account: A }), (e: unknown) => e instanceof DbError && e.code === 'O0002');
  const other = script({ open: () => [snap(null)], snapshot: () => { throw new DbError('O0007', 'closed'); } });
  await assert.rejects(openAccount({ db: other.db, account: A }), (e: unknown) => e instanceof DbError && e.code === 'O0007');

  const raced = script({ open: () => [snap(row())], pending: [claim(1)], commit: () => { throw new DbError('O0001', 'already settled'); } });
  assert.ok((await openAccount({ db: raced.db, account: A })).career);
  const broken = script({ open: () => [snap(row())], pending: [claim(1)], commit: () => { throw new DbError('O0002', 'stale'); } });
  await assert.rejects(openAccount({ db: broken.db, account: A }), (e: unknown) => e instanceof DbError && e.code === 'O0002');
});

test('openAccount pays at most 50 pending claims per open', async () => {
  const many = script({ open: () => [snap(row())], pending: Array.from({ length: 60 }, (_, i) => claim(i + 1)) });
  await openAccount({ db: many.db, account: A });
  assert.equal(many.calls.filter(c => c.fn === 'origins_commit').length, 50);
});

test('openAccount costs one psql spawn plus one per pending claim, never two per claim', async () => {
  const three = script({ open: () => [snap(row())], pending: [claim(1), claim(2), claim(3)] });
  let runs = 0;
  const counted: Db = { run: (sql, vars) => { runs++; return three.db.run(sql, vars); } };
  await openAccount({ db: counted, account: A });
  assert.equal(runs, 1 + 3);
  const none = script({ open: () => [snap(row())] });
  runs = 0;
  await openAccount({ db: { run: (sql, vars) => { runs++; return none.db.run(sql, vars); } }, account: A });
  assert.equal(runs, 1);
});
