import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSpawnJanitor } from './spawn-janitor.ts';
import type { Db } from './db.ts';

// The janitor deletes the spawn rows of layers presence no longer holds, and nothing when presence cannot say. A fake database; the real delete is proven by scripts/origins-spawns-check.mjs.
const fake = (opts: { absent?: boolean; rows?: number } = {}): { sent: string[]; db: Db } => {
  const sent: string[] = [];
  return { sent, db: { async run(sql: string, v: Record<string, string> = {}) { if (/origins_spawn_layers_sweep/.test(sql)) { sent.push(v.l!); return opts.absent ? 'absent' : String(opts.rows ?? 0); } return 'absent'; } } as Db };
};

test('a sweep sends presence\'s live layers and logs a deletion', async () => {
  const f = fake({ rows: 24 }), logs: string[] = [];
  const n = await createSpawnJanitor(f.db, async () => [1, 3], 1000, (m) => logs.push(m)).sweep();
  assert.equal(n, 24); assert.deepEqual(f.sent, ['[1,3]']);
  assert.match(logs[0]!, /deleted 24 spawn rows of closed layers \(live: 1,3\)/);
});

test('presence unreachable or malformed: nothing is sent to the database, and it says so', async () => {
  const f = fake({ rows: 24 }), logs: string[] = [];
  const n = await createSpawnJanitor(f.db, async () => { throw new Error('presence: HTTP 503'); }, 1000, (m) => logs.push(m)).sweep();
  assert.equal(n, null); assert.deepEqual(f.sent, []);
  assert.match(logs[0]!, /skipped, nothing deleted: presence: HTTP 503/);
});

test('the migration not applied: null, no error; a database error is skipped and logged, never thrown', async () => {
  assert.equal(await createSpawnJanitor(fake({ absent: true }).db, async () => [1], 1000, () => {}).sweep(), null);
  const boom = { async run() { throw new Error('db down'); } } as unknown as Db, logs: string[] = [];
  assert.equal(await createSpawnJanitor(boom, async () => [1], 1000, (m) => logs.push(m)).sweep(), null);
  assert.match(logs[0]!, /db down/);
});

test('one sweep at a time: a second call while one is running does nothing', async () => {
  let release = (): void => {}; const gate = new Promise<void>((r) => { release = r; });
  const f = fake({ rows: 0 }), j = createSpawnJanitor(f.db, async () => { await gate; return [1]; }, 1000, () => {});
  const first = j.sweep(), second = await j.sweep();
  assert.equal(second, null); release(); await first;
  assert.equal(f.sent.length, 1);
});

test('no live layer at all is a real answer (every layer closed): an empty list is sent, a null list is not even possible from the client', async () => {
  const f = fake({ rows: 3 });
  assert.equal(await createSpawnJanitor(f.db, async () => [], 1000, () => {}).sweep(), 3);
  assert.deepEqual(f.sent, ['[]']);
});
