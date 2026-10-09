// The writer's serial write queue (origins/server/server.ts serialQueue): one account's requests run one at a time, other accounts never wait,
// a failure does not block the next request, and a flooded account gets 503 'busy'. Over real HTTP with stand-in handlers; no database.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Db } from '../origins/server/db.ts';
import { BadRequest, type Handler } from '../origins/server/handlers.ts';
import { createWriter, QUEUE_MAX, serialQueue } from '../origins/server/server.ts';

const db: Db = { async run() { throw new Error('no database here'); } };
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withWriter(handlers: Record<string, Handler>, fn: (post: (op: string, token: string) => Promise<{ status: number; json: { result?: unknown; code?: string } }>) => Promise<void>) {
  const writer = createWriter({ db, verify: async (t) => ({ a1: 'acct-a', a2: 'acct-a', b1: 'acct-b' } as Record<string, string>)[t] ?? null, where: async () => null as never, handlers });
  await new Promise<void>((ok) => writer.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${(writer.address() as AddressInfo).port}/origins/`;
  try {
    await fn(async (op, token) => {
      const res = await fetch(base + op, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}' });
      return { status: res.status, json: await res.json() };
    });
  } finally { await new Promise<void>((ok) => writer.close(() => ok())); }
}

test('one account runs one request at a time; another account does not wait', async () => {
  const log: string[] = [];
  let n = 0;
  const slow: Handler = async ({ account }) => { const me = `${account}#${++n}`; log.push(`start ${me}`); await tick(40); log.push(`end ${me}`); return me; };
  await withWriter({ slow }, async (post) => {
    const [x, y, z] = await Promise.all([post('slow', 'a1'), post('slow', 'a2'), post('slow', 'b1')]);
    assert.deepEqual([x.status, y.status, z.status], [200, 200, 200]);
  });
  const a = log.filter((l) => l.includes('acct-a'));
  assert.deepEqual(a.map((l) => l.split(' ')[0]), ['start', 'end', 'start', 'end'], `acct-a never overlaps: ${a.join(', ')}`);
  assert.ok(log.indexOf(log.find((l) => l.startsWith('start acct-b'))!) < log.indexOf(log.find((l) => l.startsWith('end acct-a'))!), 'acct-b starts while acct-a is still running');
});

test('a failed request does not block the next one of the same account', async () => {
  let calls = 0;
  const flaky: Handler = async () => { calls++; if (calls === 1) { await tick(10); throw new BadRequest('first fails'); } return 'second ok'; };
  await withWriter({ flaky }, async (post) => {
    const [first, second] = await Promise.all([post('flaky', 'a1'), post('flaky', 'a2')]);
    assert.deepEqual([first.status, second.status, second.json.result], [400, 200, 'second ok']);
  });
});

test(`past ${QUEUE_MAX} waiting requests an account is told 'busy' (503); the queue drains and empties`, async () => {
  const serial = serialQueue();
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const held = Array.from({ length: QUEUE_MAX }, () => serial('k', () => gate));
  await assert.rejects(serial('k', async () => 'never'), (e: { status?: number; code?: string }) => e.status === 503 && e.code === 'busy');
  assert.equal(await serial('other', async () => 'free'), 'free', 'another key is not affected');
  release();
  await Promise.all(held);
  assert.equal(await serial('k', async () => 'after'), 'after', 'the queue accepts again once drained');
});
