import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Db } from './db.ts';
import { BadRequest, Refused } from './errors.ts';
import { grimoireGetHandler } from './grimoire-get.ts';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const fake = (reply: string): Db => ({ async run(sql) { if (!sql.includes('origins_grimoire_get')) throw Error(`unexpected sql ${sql}`); return reply; } });
const call = (db: Db) => grimoireGetHandler({ db, account: A }, {}) as Promise<{ spells: { legend: string; bricks: unknown }[] }>;

test('grimoire_get: the taken spells, sorted by legend id', async () => {
  const b = (root: string) => ({ root, modifiers: [], suffix: null });
  const { spells } = await call(fake(JSON.stringify({ zeta: b('a'), eloko: b('b') })));
  assert.deepEqual(spells, [{ legend: 'eloko', bricks: b('b') }, { legend: 'zeta', bricks: b('a') }]);
});

test('grimoire_get: an empty book, a disallowed account and a missing migration', async () => {
  assert.deepEqual(await call(fake('{}')), { spells: [] });
  await assert.rejects(call(fake('null')), BadRequest);
  await assert.rejects(call(fake('absent')), (e: unknown) => e instanceof Refused && e.status === 503);
});
