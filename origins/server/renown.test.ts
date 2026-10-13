// title_get (origins/server/renown.ts) against a stand-in database. The real-Postgres half is scripts/origins-writer-check.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Db } from './db.ts';
import { BadRequest, Refused } from './errors.ts';
import { titleGet } from './renown.ts';
import { titleFor } from '../../src/fight/titles.ts';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const fakeDb = (row: string | null, installed = true): Db => ({
  async run(sql) { if (sql.includes('to_regprocedure') && !installed) return 'absent'; return row ?? 'null'; },
});

test('title_get returns fame, karma and the title those earn', async () => {
  const r = await titleGet({ db: fakeDb('{"fame":9000,"karma":-12000}'), account: A }, { character: 'pc:one' }) as { fame: number; karma: number; title: string };
  assert.equal(r.fame, 9000); assert.equal(r.karma, -12000);
  assert.equal(r.title, titleFor(9000, -12000));
});

test('title_get: a character that is not this account\'s is a 400, a missing migration a 503, a bad id a 400', async () => {
  await assert.rejects(titleGet({ db: fakeDb(null), account: A }, { character: 'pc:one' }), BadRequest);
  await assert.rejects(titleGet({ db: fakeDb(null), account: A }, { character: 'nope' }), BadRequest);
  await assert.rejects(titleGet({ db: fakeDb(null, false), account: A }, { character: 'pc:one' }), (e: unknown) => e instanceof Refused && e.status === 503);
});
