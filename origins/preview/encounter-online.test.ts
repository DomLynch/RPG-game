// The preview's online path (encounter-online.ts): who may go online, that it plays the server's seed, the touch timer, the settle outcomes (a 409 is "already settled", never an error),
// and a round trip against the real writer handlers. The offline path is not touched: with no ?online=1, no session or no character nothing is requested at all.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { STEP } from '../../src/sim.ts';
import { beginOnline, onlineWanted, RETRY_AFTER_MS, TOUCH_EVERY_MS } from './encounter-online.ts';
import { createWriter } from '../server/server.ts';
import { encounterOps } from '../server/encounter.ts';
import { ACCOUNT, CHAR, deps, fakeDb, finishedFight, playFight } from '../server/encounter-fixtures.ts';
import { fakeWhere } from '../presence/fixtures.ts';

const run = { token: 'T'.repeat(32), seed: 4242, enemy: 'wolf', level: 3, bar: null, flags: [], layer: null, startTick: 0, lastTick: 0, graceS: 120, expiresAt: '2026-10-07T20:00:00.000Z' };
const setup = { opponent: { body: 'wolf', level: 3 } } as never;
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const record = playFight(7, 1)!;

function server(answer: (op: string, n: number) => Response | Promise<Response>) {
  const calls: string[] = [], bodies: unknown[] = [];
  const f = (async (url: string, init: RequestInit) => { const op = url.split('/').pop()!; calls.push(op); bodies.push(JSON.parse(String(init.body))); return answer(op, calls.filter((c) => c === op).length); }) as unknown as typeof fetch;
  return { f, calls, bodies };
}
const ok = (op: string): Response => reply(200, { ok: true, result: op === 'encounter_settle' ? { result: 'won', verified: true, twist: null, ticks: record.ticks, event: 'enc:x' } : run });

test('?online=1 is the only switch', () => {
  for (const [search, want] of [['?online=1', true], ['?region=1&online=1', true], ['?online=1&region=1', true], ['', false], ['?online=0', false], ['?online=10', false], ['?region=1', false]] as const) assert.equal(onlineWanted(search), want, search);
});

test('signed out or no character: null, and not one request is made (the offline path is untouched)', async () => {
  const s = server(ok);
  assert.equal(await beginOnline({ token: null, character: CHAR, fight: 'wolf', setup, fetch: s.f }), null);
  assert.equal(await beginOnline({ token: 'tok', character: null, fight: 'wolf', setup, fetch: s.f }), null);
  assert.deepEqual(s.calls, []);
});

test('the flag off (503), no session (401), a second open fight (409, with no remembered token) and a network failure all play offline', async () => {
  for (const status of [503, 401, 409, 403]) assert.equal(await beginOnline({ token: 'tok', character: CHAR, fight: 'wolf', setup, fetch: server(() => reply(status, { ok: false })).f }), null, String(status));
  assert.equal(await beginOnline({ token: 'tok', character: CHAR, fight: 'wolf', setup, fetch: (async () => { throw new TypeError('down'); }) as unknown as typeof fetch }), null);
});

test('a foe the server resolved differently from the page is not played online, and says so (the server\'s token stays open until its grace runs out)', async () => {
  const s = server(() => reply(200, { ok: true, result: { ...run, level: 9 } })), warned: string[] = [];
  assert.equal(await beginOnline({ token: 'tok', character: CHAR, fight: 'wolf', setup, fetch: s.f, warn: (m) => warned.push(m) }), null);
  assert.equal(warned.length, 1);
  assert.match(warned[0]!, /wolf L9.*wolf L3.*playing offline.*TTTTTT.*stays open/s);
});

test('online: the server\'s seed is played, start names only the character and the fight', async () => {
  const s = server(ok), on = await beginOnline({ token: 'tok', character: CHAR, fight: 'wolf', setup, fetch: s.f, every: (() => 1) as never, clear: (() => {}) as never });
  assert.equal(on?.seed, 4242);
  assert.deepEqual(s.bodies[0], { character: CHAR, encounter: 'wolf' });
});

test('touch fires on the timer with the elapsed tick, and stops when the player leaves or settles', async () => {
  const s = server(ok); let fire: (() => void) | undefined, cleared = 0, t = 1000;
  const on = (await beginOnline({ token: 'tok', character: CHAR, fight: 'wolf', setup, fetch: s.f, now: () => t, every: ((fn: () => void, ms: number) => { assert.equal(ms, TOUCH_EVERY_MS); fire = fn; return 7; }) as never, clear: ((id: number) => { assert.equal(id, 7); cleared++; }) as never }))!;
  t += 30_000; fire!(); await Promise.resolve(); await new Promise((r) => setImmediate(r));
  assert.deepEqual(s.calls, ['encounter_start', 'encounter_touch']);
  assert.deepEqual(s.bodies[1], { token: run.token, tick: Math.round(30_000 / (STEP * 1000)) });
  on.stop(); on.stop();
  assert.equal(cleared, 1, 'stopped once, a second stop does nothing');
});

test('settle: verified, unverified, no record (nothing sent), and a 409 is already settled, never an error', async () => {
  const mk = async (answer: (op: string, n: number) => Response) => { const s = server(answer); return { s, on: (await beginOnline({ token: 'tok', character: CHAR, fight: 'wolf', setup, fetch: s.f, every: (() => 1) as never, clear: (() => {}) as never }))! }; };
  let a = await mk(ok);
  assert.equal(await a.on.settle({ result: 'won', record }), 'settled');
  assert.equal(await a.on.settle({ result: 'won', record }), 'already', 'a second settle sends nothing');
  assert.equal(a.s.calls.filter((c) => c === 'encounter_settle').length, 1);
  a = await mk((op) => (op === 'encounter_settle' ? reply(200, { ok: true, result: { result: 'lost', verified: false, twist: null, ticks: 0, event: 'enc:x', reason: 'r' } }) : ok(op)));
  assert.equal(await a.on.settle({ result: 'won', record }), 'unverified');
  a = await mk(ok);
  assert.equal(await a.on.settle({ result: 'won' }), 'no-record');
  assert.equal(a.s.calls.includes('encounter_settle'), false);
  a = await mk((op) => (op === 'encounter_settle' ? reply(409, { ok: false, error: 'encounter token unknown, used or expired' }) : ok(op)));
  assert.equal(await a.on.settle({ result: 'won', record }), 'already', 'the server already settled this token: done');
});

test('a reply lost after the server settled: the retry gets 409 and that is "already settled"', async () => {
  let n = 0; const waits: number[] = [];
  const s = server((op) => { if (op !== 'encounter_settle') return ok(op); n++; if (n === 1) throw new TypeError('timeout'); return reply(409, { ok: false, error: 'used' }); });
  const on = (await beginOnline({ token: 'tok', character: CHAR, fight: 'wolf', setup, fetch: s.f, every: (() => 1) as never, clear: (() => {}) as never, wait: async (ms) => { waits.push(ms); } }))!;
  assert.equal(await on.settle({ result: 'won', record }), 'already');
  assert.equal(n, 2);
  assert.deepEqual(waits, [RETRY_AFTER_MS[0]]);
});

test('a settle the server cannot be reached for is retried after the waits, then offline; a 5xx is retried too, a 4xx is not', async () => {
  const mk = (status: number | 'down') => { let n = 0; const waits: number[] = [], s = server((op) => { if (op !== 'encounter_settle') return ok(op); n++; if (status === 'down') throw new TypeError('down'); return reply(status, { ok: false }); }); return { s, count: () => n, waits, start: () => beginOnline({ token: 'tok', character: CHAR, fight: 'wolf', setup, fetch: s.f, every: (() => 1) as never, clear: (() => {}) as never, wait: async (ms) => { waits.push(ms); } }) }; };
  let c = mk('down'); let on = (await c.start())!;
  assert.equal(await on.settle({ result: 'won', record }), 'offline');
  assert.equal(c.count(), 1 + RETRY_AFTER_MS.length); assert.deepEqual(c.waits, RETRY_AFTER_MS);
  c = mk(503); on = (await c.start())!;
  assert.equal(await on.settle({ result: 'won', record }), 'offline');
  assert.equal(c.count(), 1 + RETRY_AFTER_MS.length);
  c = mk(401); on = (await c.start())!;
  assert.equal(await on.settle({ result: 'won', record }), 'offline');
  assert.equal(c.count(), 1, 'no retry on a 4xx: the server answered');
  assert.deepEqual(c.waits, []);
});

// The real writer: createWriter(+ encounterOps, the real verifier) on a loopback port.
test('round trip against the real writer: the page plays the server seed, settles once, and a repeat settle is already settled', async () => {
  const clock = { t: 1e6 }, { db, events } = fakeDb(clock);
  const writer = createWriter({ db, verify: async (t) => (t === 'tok' ? ACCOUNT : null), where: fakeWhere({}), handlers: encounterOps(deps()) });
  await new Promise<void>((ok2) => writer.listen(0, '127.0.0.1', ok2));
  try {
    const base = `http://127.0.0.1:${(writer.address() as AddressInfo).port}/origins`;
    const on = (await beginOnline({ token: 'tok', character: CHAR, fight: 'encounter:knight', setup: { opponent: { body: 'knight', level: 6 } } as never, base, every: (() => 1) as never, clear: (() => {}) as never }))!;
    assert.ok(on, 'the real writer started the fight');
    const played = finishedFight(on.seed);
    assert.equal(await on.settle({ result: 'won', record: played }), 'settled');
    assert.equal(events.length, 1);
    const again = (await beginOnline({ token: 'tok', character: CHAR, fight: 'encounter:knight', setup: { opponent: { body: 'knight', level: 6 } } as never, base, every: (() => 1) as never, clear: (() => {}) as never }))!;
    assert.ok(again, 'the next fight can start once the first is settled');
  } finally { await new Promise<void>((ok2) => writer.close(() => ok2())); }
});

test('a 409 on start with a remembered open token resumes it: touch (not start) answers, the same seed is played, and the token is remembered', async () => {
  let held: string | null = 'H'.repeat(32);
  const s = server((op) => (op === 'encounter_start' ? reply(409, { ok: false }) : reply(200, { ok: true, result: { ...run, token: held, seed: 777 } })));
  const on = await beginOnline({ token: 'tok', character: CHAR, fight: 'wolf', setup, fetch: s.f, held: { get: () => held, set: (t) => { held = t; } }, every: (() => 1) as never, clear: (() => {}) as never });
  assert.equal(on?.seed, 777);
  assert.deepEqual(s.calls, ['encounter_start', 'encounter_touch']);
  assert.deepEqual(s.bodies[1], { token: 'H'.repeat(32), tick: 0 });
  assert.equal(held, 'H'.repeat(32));
  assert.equal(await on!.settle({ result: 'won', record: null }), 'no-record');
  assert.equal(held, null, 'a settled fight forgets its token');
});

test('a 409 with nothing remembered, or a remembered token the server no longer holds, still plays offline (and a dead token is forgotten)', async () => {
  const none = server(() => reply(409, { ok: false }));
  assert.equal(await beginOnline({ token: 'tok', character: CHAR, fight: 'wolf', setup, fetch: none.f, held: { get: () => null, set: () => assert.fail('nothing to store') } }), null);
  assert.deepEqual(none.calls, ['encounter_start'], 'no token, no touch');
  let held: string | null = 'D'.repeat(32);
  const dead = server(() => reply(409, { ok: false }));
  assert.equal(await beginOnline({ token: 'tok', character: CHAR, fight: 'wolf', setup, fetch: dead.f, held: { get: () => held, set: (t) => { held = t; } } }), null);
  assert.deepEqual(dead.calls, ['encounter_start', 'encounter_touch']);
  assert.equal(held, null);
});

test('a 409 whose remembered token has been played (lastTick > 0) is NOT resumed: the token is forgotten and the page plays offline (a loser must not replay the same seed)', async () => {
  let held: string | null = 'P'.repeat(32);
  const s = server((op) => (op === 'encounter_start' ? reply(409, { ok: false }) : reply(200, { ok: true, result: { ...run, token: held, lastTick: 90 } })));
  assert.equal(await beginOnline({ token: 'tok', character: CHAR, fight: 'wolf', setup, fetch: s.f, held: { get: () => held, set: (t) => { held = t; } } }), null);
  assert.deepEqual(s.calls, ['encounter_start', 'encounter_touch']);
  assert.equal(held, null, 'forgotten, so no later 409 can resume it either');
});
