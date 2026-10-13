import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Db } from './db.ts';
import { createLiveOps } from './live-ops.ts';
import { createWriter } from './server.ts';

const rows = { events: [{ id: 'friday', cron: '0 18 * * 5', lengthMin: 120, kind: 'double-xp', enabled: true, params: {} }, { id: 'bad', cron: 'nope', lengthMin: 5, kind: 'k', enabled: true }], switches: [{ key: 'op:ping', enabled: false }] };

function fakeDb(answer: () => string) {
  const db: Db = { async run() { return answer(); } };
  return db;
}

test('a minute read: rows in, bad row dropped and logged, active events follow the clock', async () => {
  const logs: string[] = [];
  let clock = Date.parse('2026-10-16T18:30:00Z');
  const lo = createLiveOps(fakeDb(() => JSON.stringify(rows)), 60_000, () => clock, m => logs.push(m));
  assert.equal(lo.switchOn('op:ping'), true, 'before the first read: the defaults');
  await lo.refresh();
  assert.equal(lo.switchOn('op:ping'), false);
  assert.deepEqual(lo.active().map(e => e.id), ['friday']);
  clock = Date.parse('2026-10-16T20:01:00Z');
  assert.deepEqual(lo.active(), [], 'two hours later the event is over without another read');
  assert.equal(logs.length, 1); assert.match(logs[0]!, /bad.*ignored/);
  assert.equal(lo.snapshot().rejected, 1);
});

test('a failed read keeps the last good rows; a migration that is not applied means the defaults', async () => {
  let mode: 'ok' | 'boom' | 'absent' = 'ok';
  const logs: string[] = [];
  const db = fakeDb(() => { if (mode === 'boom') throw new Error('connection lost'); return mode === 'absent' ? 'absent' : JSON.stringify(rows); });
  const lo = createLiveOps(db, 60_000, Date.now, m => logs.push(m));
  await lo.refresh();
  mode = 'boom'; await lo.refresh();
  assert.equal(lo.switchOn('op:ping'), false, 'the switch stays off through a database blip');
  assert.match(logs.at(-1)!, /keeping the last rows/);
  mode = 'absent'; await lo.refresh();
  assert.equal(lo.switchOn('op:ping'), true, 'rows gone (down-script) = defaults');
});

test('the writer answers 503 for an op whose switch is off, with no restart, and runs it when it is back on', async () => {
  let off = true;
  const calls: string[] = [];
  const w = createWriter({ db: fakeDb(() => ''), verify: async () => 'acct', where: async () => ({ online: false }), handlers: { ping: async () => { calls.push('ping'); return { pong: 1 }; }, other: async () => ({ ok: 1 }) },
    liveOps: { switchOn: key => !(off && key === 'op:ping') } });
  await new Promise<void>(r => w.listen(0, '127.0.0.1', r));
  try {
    const post = (op: string) => globalThis.fetch(`http://127.0.0.1:${(w.address() as AddressInfo).port}/origins/${op}`, { method: 'POST', headers: { authorization: 'Bearer t' }, body: '{}' });
    const a = await post('ping');
    assert.equal(a.status, 503); assert.deepEqual(await a.json(), { ok: false, error: 'switched off', code: 'switched-off' });
    assert.equal((await post('other')).status, 200, 'only the named op is off');
    off = false;
    assert.equal((await post('ping')).status, 200);
    assert.deepEqual(calls, ['ping'], 'the switched-off call never reached the handler');
  } finally { w.close(); }
});
