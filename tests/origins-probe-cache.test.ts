// store.ts gated(): a migration's function seen PRESENT is not probed again (one round trip fewer per call); one seen ABSENT is probed on every call, so a migration applied without a restart is
// picked up; a function that goes missing after being cached (a down-script, 42883) falls back to the probe once. Stand-in Db: no database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DbError, type Db } from '../origins/server/db.ts';
import { lastPaidKill, metalOf, setActive } from '../origins/server/store.ts';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function fake(answer: (sql: string, n: number) => string) {
  const sqls: string[] = []; let n = 0;
  const db: Db = { async run(sql) { sqls.push(sql); return answer(sql, n++); } };
  return { db, sqls, probed: () => sqls.filter((s) => s.includes('to_regprocedure')).length };
}

test('a present function is probed once, then called bare', async () => {
  const { db, sqls, probed } = fake(() => '{"bronze":7,"version":1}');
  for (let i = 0; i < 4; i++) assert.deepEqual(await metalOf(db, A), { bronze: 7, version: 1 });
  assert.equal(probed(), 1, 'one probe for four calls');
  assert.ok(!sqls[1]!.includes('\\if') && sqls[1]!.includes('origins_metal_of'), 'the cached call is the bare select');
});

test('an absent function is probed on every call, and a migration applied meanwhile is picked up without a restart', async () => {
  let applied = false;
  const { db, probed } = fake((sql) => (applied && sql.includes('origins_metal_of') ? '{"bronze":1,"version":1}' : 'absent'));
  assert.equal(await metalOf(db, A), 'absent');
  assert.equal(await metalOf(db, A), 'absent');
  assert.equal(probed(), 2, 'absent re-probes');
  applied = true;
  assert.deepEqual(await metalOf(db, A), { bronze: 1, version: 1 });
  assert.deepEqual(await metalOf(db, A), { bronze: 1, version: 1 });
  assert.equal(probed(), 3, 'the call after it appeared is probed once more, then cached');
});

test('a cached function that is gone (42883) falls back to the probe once and reports absent', async () => {
  let gone = false;
  const { db, probed } = fake((sql) => {
    if (!gone) return 't';
    if (!sql.includes('to_regprocedure')) throw new DbError('42883', 'function public.origins_set_active does not exist');
    return 'absent';
  });
  assert.equal(await setActive(db, A, 'pc:1'), true);
  assert.equal(await setActive(db, A, 'pc:1'), true);
  gone = true;
  assert.equal(await setActive(db, A, 'pc:1'), 'absent', 'the missing function answers absent, not a 500');
  assert.equal(probed(), 2, 'one probe at the start, one after the 42883');
});

test('other refusals are not swallowed by the cache; two Dbs do not share it', async () => {
  const first = fake(() => 'null');
  assert.equal(await lastPaidKill(first.db, A, 'f'), null);
  const bad: Db = { async run() { throw new DbError('O0002', 'stale'); } };
  await assert.rejects(lastPaidKill(bad, A, 'f'), (e: DbError) => e.code === 'O0002');
  const second = fake(() => 'null');
  await lastPaidKill(second.db, A, 'f');
  assert.equal(second.probed(), 1, 'a different Db probes for itself');
});
