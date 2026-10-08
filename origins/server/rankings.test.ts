import assert from 'node:assert/strict';
import test from 'node:test';
import type { Db } from './db.ts';
import { BadRequest, Refused } from './errors.ts';
import { cumulative } from '../progression/model.ts';
import { ranked, rankingsOps } from './rankings.ts';

const A = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b', B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
// A stub database: answers origins_rankings with `boards[board]` and counts the reads; 'absent' when the migration is not applied.
const stub = (boards: Record<string, { name: string; value: number }[]> | 'absent') => {
  const calls: string[] = [];
  const db = { run: async (_sql: string, v?: Record<string, string>) => { calls.push(v?.b ?? ''); return boards === 'absent' ? 'absent' : JSON.stringify(boards[v!.b!] ?? []); } } as unknown as Db;
  return { db, calls };
};
const ctx = (db: Db, account = A) => ({ db, account, where: async () => ({ online: false }) }) as never;

test('ranked: standard competition ranks, equal values share a rank', () => {
  assert.deepEqual(ranked([{ name: 'a', value: 9 }, { name: 'b', value: 7 }, { name: 'c', value: 7 }, { name: 'd', value: 3 }]).map((r) => r.rank), [1, 2, 2, 4]);
  assert.deepEqual(ranked([]), []);
});

test('rankings: one shape for every board; level turns total CP into the level; no account id in the answer; limit slices', async () => {
  const { db } = stub({ level: [{ name: 'Orla', value: cumulative(7) }, { name: 'Bren', value: cumulative(3) + 1 }], kills: [{ name: 'Orla', value: 12 }], pvp: [], pit: [{ name: 'Dom', value: 4 }] });
  const { rankings } = rankingsOps();
  const level = await rankings!(ctx(db), { board: 'level' }) as { board: string; at: string; rows: unknown[] };
  assert.equal(level.board, 'level'); assert.ok(!Number.isNaN(Date.parse(level.at)));
  assert.deepEqual(level.rows, [{ rank: 1, name: 'Orla', value: 7 }, { rank: 2, name: 'Bren', value: 3 }]);
  assert.deepEqual((await rankings!(ctx(db), { board: 'kills', limit: 1 }) as { rows: unknown[] }).rows, [{ rank: 1, name: 'Orla', value: 12 }]);
  assert.deepEqual((await rankings!(ctx(db), { board: 'pvp' }) as { rows: unknown[] }).rows, []);
  assert.ok(!JSON.stringify(await rankings!(ctx(db), { board: 'pit' })).includes(A), 'no account id');
});

test('rankings: a bad board or limit is a 400', async () => {
  const { rankings } = rankingsOps(), { db } = stub({});
  for (const body of [{}, { board: 'sets' }, { board: 'level', limit: 0 }, { board: 'level', limit: 51 }, { board: 'level', limit: 2.5 }]) await assert.rejects(rankings!(ctx(db), body as never), BadRequest, JSON.stringify(body));
});

test('rankings: each board is read from the database at most once per cache window, however many accounts read it', async () => {
  let t = 1_000_000; const { db, calls } = stub({ kills: [{ name: 'Orla', value: 1 }] }), { rankings } = rankingsOps({ now: () => t, cacheMs: 60_000 });
  for (const acct of [A, B, A, B]) await rankings!(ctx(db, acct), { board: 'kills' });
  assert.deepEqual(calls, ['kills'], 'one read for four requests');
  t += 60_000; await rankings!(ctx(db), { board: 'kills' });
  assert.deepEqual(calls, ['kills', 'kills'], 'the window passed: read again');
});

test('rankings: an account past perMinute reads gets a 429; another account and the next minute are not limited', async () => {
  let t = 1_000_000; const { db } = stub({ pit: [] }), { rankings } = rankingsOps({ now: () => t, perMinute: 3 });
  for (let i = 0; i < 3; i++) await rankings!(ctx(db), { board: 'pit' });
  await assert.rejects(rankings!(ctx(db), { board: 'pit' }), (e: unknown) => e instanceof Refused && e.status === 429 && e.code === 'rate-limit');
  await rankings!(ctx(db, B), { board: 'pit' });
  t += 60_000; await rankings!(ctx(db), { board: 'pit' });
});

test('rankings: the migration not applied answers 503 not-installed', async () => {
  const { db } = stub('absent'), { rankings } = rankingsOps();
  await assert.rejects(rankings!(ctx(db), { board: 'level' }), (e: unknown) => e instanceof Refused && e.status === 503 && e.code === 'not-installed');
});
