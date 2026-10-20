import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BETA_SPECIAL_PICK } from '../../src/core/server.ts';
import { type Db } from './db.ts';
import { BadRequest, Refused } from './errors.ts';
import { specialSlotsGet, specialSlotsSet } from './special-slots.ts';
import { handlers } from './handlers.ts';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', PC = 'pc:one';
const [ONE, TWO] = BETA_SPECIAL_PICK as readonly [string, string];
type Sent = { sql: string; v?: Record<string, string> };
const fake = (o: { row?: unknown; missing?: boolean } = {}): { db: Db; sent: Sent[] } => {
  const sent: Sent[] = [];
  return { sent, db: { async run(sql, v) {
    sent.push({ sql, v });
    if (sql.includes('to_regprocedure') && o.missing) return 'absent';
    if (sql.includes('public.origins_special_slots_get(') || sql.includes('public.origins_special_slots_set(')) return o.row === undefined ? 'null' : JSON.stringify(o.row);
    if (sql.includes('to_regprocedure')) return '';
    throw Error(`unexpected sql ${sql}`);
  } } };
};
const get = (db: Db, body: Record<string, unknown> = { character: PC }) => specialSlotsGet({ db, account: A }, body);
const set = (db: Db, body: Record<string, unknown>) => specialSlotsSet({ db, account: A }, body);

test('special slots: the ops are registered', () => {
  assert.equal(handlers.special_slots_get, specialSlotsGet); assert.equal(handlers.special_slots_set, specialSlotsSet);
});

test('special_slots_get: what is stored; no row reads as both empty (the client then uses the row defaults); a stale pick the cut dropped reads as none', async () => {
  assert.deepEqual(await get(fake({ row: { slot1: ONE, slot2: TWO } }).db), { slot1: ONE, slot2: TWO });
  assert.deepEqual(await get(fake({ row: { slot1: null, slot2: null } }).db), { slot1: null, slot2: null });
  assert.deepEqual(await get(fake({ row: { slot1: 'notapick', slot2: TWO } }).db), { slot1: null, slot2: TWO });
});

test('special_slots_get: a bad character id, a character that is not yours, and a missing migration are refused', async () => {
  await assert.rejects(get(fake().db, { character: 'x' }), BadRequest);
  await assert.rejects(get(fake({ row: undefined }).db), BadRequest);
  await assert.rejects(get(fake({ missing: true }).db), (e: unknown) => e instanceof Refused && e.status === 503);
});

test('special_slots_set: writes the two picks (null = none) for the account and character; an omitted slot is cleared', async () => {
  const a = fake({ row: { slot1: ONE, slot2: TWO } });
  assert.deepEqual(await set(a.db, { character: PC, slot1: ONE, slot2: TWO }), { slot1: ONE, slot2: TWO });
  const call = a.sent.find((s) => s.sql.includes('origins_special_slots_set('))!;
  assert.deepEqual(call.v, { a: A, c: PC, s1: ONE, s2: TWO });
  const b = fake({ row: { slot1: ONE, slot2: null } });
  assert.deepEqual(await set(b.db, { character: PC, slot1: ONE }), { slot1: ONE, slot2: null });
  assert.deepEqual(b.sent.find((s) => s.sql.includes('origins_special_slots_set('))!.v, { a: A, c: PC, s1: ONE, s2: '' }, 'an empty slot is sent as the empty string the SQL turns into null');
});

test('special_slots_set: a skill outside the beta pick list, a malformed id, the same skill twice, a non-string, a stranger and a missing migration are refused and nothing is written', async () => {
  const w = fake({ row: { slot1: ONE, slot2: TWO } });
  for (const body of [{ slot1: 'notapick' }, { slot1: 'Lunge' }, { slot1: ONE, slot2: ONE }, { slot1: 7 }, { slot2: '../etc' }, { slot1: ONE, slot2: { id: TWO } }, { character: 'x' }]) {
    await assert.rejects(set(w.db, { character: PC, ...body }), BadRequest, JSON.stringify(body));
  }
  assert.equal(w.sent.some((s) => s.sql.includes('origins_special_slots_set(')), false, 'a refused pick never reaches the database');
  await assert.rejects(set(fake({ row: undefined }).db, { character: PC, slot1: ONE }), BadRequest);
  await assert.rejects(set(fake({ missing: true }).db, { character: PC, slot1: ONE }), (e: unknown) => e instanceof Refused && e.status === 503);
});
