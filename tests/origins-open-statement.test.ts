// store.ts openWithPending: open and the pending Pit claims are ONE statement (one round trip to the database), two answers on two lines.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Db } from '../origins/server/db.ts';
import { openWithPending } from '../origins/server/store.ts';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('open and the pending Pit claims are one statement: one round trip, two answers on two lines', async () => {
  const calls: string[] = [];
  const db: Db = { async run(sql) { calls.push(sql); return `${JSON.stringify({ marks: 4, career: null, characters: [], items: [], quests: [], journal: [], talk: [] })}\n[]`; } };
  const got = await openWithPending(db, A, 50);
  assert.deepEqual([calls.length, got.snap.marks, got.pending], [1, 4, []]);
  assert.equal(calls[0]!.split(';').filter((s) => s.trim()).length, 1, 'a single statement');
});
