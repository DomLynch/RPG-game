import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Db } from './db.ts';
import { createWriter } from './server.ts';
import { createLocationFlusher } from './location-flush.ts';

const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b', C = '00000000-0000-4000-8000-00000000000c';
const seen = (x: number, atMs: number) => ({ x, z: 7, zone: 'pit-yard', atMs });
const quiet = () => undefined;

function fakeDb(refuse: (vars: Readonly<Record<string, string>>) => boolean = () => false) {
  const calls: { sql: string; vars: Readonly<Record<string, string>> }[] = [];
  const db: Db = { async run(sql, vars = {}) { calls.push({ sql, vars }); if (refuse(vars)) throw new Error('refused'); return vars.a === undefined ? '' : '{"character":null,"stored":true}'; } };
  return { db, calls };
}

test('N dirty accounts go out as ONE statement; the latest observation per account wins; the map is empty after', async () => {
  const { db, calls } = fakeDb();
  const f = createLocationFlusher(db, 90_000, quiet);
  f.mark(A, seen(1, 100)); f.mark(B, seen(2, 100)); f.mark(A, seen(3, 200)); f.mark(A, seen(4, 150)); f.mark(C, seen(5, 100));
  assert.equal(f.size(), 3);
  assert.deepEqual(await f.flush(), { rows: 3, batches: 1 });
  assert.equal(calls.length, 1, 'one round trip');
  const rows = JSON.parse(calls[0]!.vars.rows!) as { a: string; x: number; t: number }[];
  assert.deepEqual(rows.map(r => [r.a, r.x, r.t]).sort(), [[A, 3, 200], [B, 2, 100], [C, 5, 100]], 'a late older observation never replaces a newer one');
  assert.match(calls[0]!.sql, /jsonb_to_recordset\(:'rows'::jsonb\)/);
  assert.match(calls[0]!.sql, /origins_save_location/);
  assert.equal(f.size(), 0);
  assert.deepEqual(await f.flush(), { rows: 0, batches: 0 });
  assert.equal(calls.length, 1, 'nothing dirty, nothing sent');
});

test('nothing pays twice: a flushed row is not sent again, a mark after the flush is', async () => {
  const { db, calls } = fakeDb();
  const f = createLocationFlusher(db, 90_000, quiet);
  f.mark(A, seen(1, 100)); await f.flush(); await f.flush();
  assert.equal(calls.length, 1);
  f.mark(A, seen(2, 300)); await f.flush();
  assert.equal(calls.length, 2);
});

test('a batch the database refuses falls back row by row: the refused row stays dirty, the rest are written', async () => {
  const { db, calls } = fakeDb(v => v.rows !== undefined || v.a === B);
  const f = createLocationFlusher(db, 90_000, quiet);
  f.mark(A, seen(1, 100)); f.mark(B, seen(2, 100)); f.mark(C, seen(3, 100));
  const out = await f.flush();
  assert.equal(out.rows, 3);
  assert.equal(calls.filter(c => c.vars.a !== undefined).length, 3, 'each row tried singly');
  assert.equal(f.size(), 1); assert.ok(f.has(B), 'only the refused row is kept for the next flush');
});

test('a mark that lands while a flush is in flight is kept for the next one', async () => {
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  const calls: string[] = [];
  const db: Db = { async run(_sql, vars = {}) { calls.push(vars.rows ?? ''); if (calls.length === 1) await gate; return ''; } };
  const f = createLocationFlusher(db, 90_000, quiet);
  f.mark(A, seen(1, 100));
  const first = f.flush();
  await new Promise(r => setImmediate(r));
  f.mark(B, seen(2, 100));
  const second = f.flush();
  release();
  await first; await second;
  assert.equal(calls.length, 2);
  assert.deepEqual((JSON.parse(calls[1]!) as { a: string }[]).map(r => r.a), [B]);
});

test('stop() writes what is left; an interval of 0 is refused', async () => {
  const { db, calls } = fakeDb();
  const f = createLocationFlusher(db, 90_000, quiet);
  f.start(); f.mark(A, seen(1, 100));
  await f.stop();
  assert.equal(calls.length, 1);
  assert.throws(() => createLocationFlusher(db, 0), /positive integer/);
});

test('the writer settles an account\'s held spot BEFORE any op of that account runs (open / create_character switch the active character); a refused spot is dropped, never kept for the new character', async () => {
  const order: string[] = [];
  let refuse = false;
  const db: Db = { async run(_sql, vars = {}) { if (vars.rows !== undefined || vars.a !== undefined) { order.push('write'); if (refuse) throw new Error('refused'); } return vars.a === undefined ? '' : '{"character":null,"stored":true}'; } };
  const f = createLocationFlusher(db, 90_000, quiet);
  const w = createWriter({ db, verify: async () => A, where: async () => ({ online: false }), handlers: { open: async () => { order.push('open'); return {}; } }, internal: { key: 'k', flusher: f } });
  await new Promise<void>(r => w.listen(0, '127.0.0.1', r));
  try {
    const open = () => globalThis.fetch(`http://127.0.0.1:${(w.address() as AddressInfo).port}/origins/open`, { method: 'POST', headers: { authorization: 'Bearer t' }, body: '{}' });
    f.mark(A, seen(1, 100));
    assert.equal((await open()).status, 200);
    assert.deepEqual(order, ['write', 'open'], 'the spot is written first');
    assert.equal(f.has(A), false);
    order.length = 0;
    assert.equal((await open()).status, 200);
    assert.deepEqual(order, ['open'], 'nothing held: no extra write');
    order.length = 0; refuse = true;
    f.mark(A, seen(2, 200)); f.mark(B, seen(3, 200));
    assert.equal((await open()).status, 200);
    assert.equal(f.has(A), false, 'a spot the database refused is dropped before the switch can run');
    assert.equal(f.has(B), true, 'another account\'s held spot is untouched by A\'s op');
  } finally { w.close(); }
});
