// The client half of a server-held world fight (encounter-net.ts): what it sends, every way the writer can fail -> offline, and a full start -> touch -> settle round trip against the REAL writer
// handlers (createWriter + encounterOps + the real verifyEncounter) over HTTP, the fake database standing in for migration 202610080002.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { fromBase64Url, packRecord, unpackRecord } from '../../src/record.ts';
import { isOffline } from './save.ts';
import { fightOf, settledOf, settleFight, startFight, touchFight } from './encounter-net.ts';
import { createWriter } from '../server/server.ts';
import { encounterOps } from '../server/encounter.ts';
import { ACCOUNT, CHAR, deps, fakeDb, finishedFight, playFight } from '../server/encounter-fixtures.ts';
import { fakeWhere } from '../presence/fixtures.ts';

const fight = { token: 'T'.repeat(32), seed: 7, enemy: 'knight', level: 6, bar: null, flags: [], layer: null, startTick: 0, lastTick: 0, graceS: 120, expiresAt: '2026-10-07T20:00:00.000Z' };
const reply = (status: number, body: unknown) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
function recorder(answer: (url: string, init: RequestInit) => Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return answer(url, init); }) as unknown as typeof fetch;
  return { f, calls };
}

test('start posts the character and the fight id and nothing a client could forge: no foe, level, seed, reward or account', async () => {
  const { f, calls } = recorder(async () => reply(200, { ok: true, result: fight }));
  const got = await startFight('tok', CHAR, 'encounter:knight', { base: '/origins', fetch: f });
  assert.deepEqual(got, fight);
  assert.equal(calls[0]!.url, '/origins/encounter_start');
  assert.equal(calls[0]!.init.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { character: CHAR, encounter: 'encounter:knight' });
  assert.equal((calls[0]!.init.headers as Record<string, string>).authorization, 'Bearer tok');
  assert.equal(calls[0]!.init.credentials, 'omit');
  await startFight('tok', CHAR, 'encounter:knight', { base: '/origins', fetch: f, tick: 40 });
  assert.deepEqual(JSON.parse(String(calls[1]!.init.body)), { character: CHAR, encounter: 'encounter:knight', tick: 40 });
});

test('touch posts the fight token and the tick', async () => {
  const { f, calls } = recorder(async () => reply(200, { ok: true, result: fight }));
  assert.deepEqual(await touchFight('tok', fight.token, 90, { base: '/origins', fetch: f }), fight);
  assert.equal(calls[0]!.url, '/origins/encounter_touch');
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { token: fight.token, tick: 90 });
});

test('no session sends nothing; every failure is an answer, never a throw', async () => {
  const { f, calls } = recorder(async () => reply(200, { ok: true, result: fight }));
  assert.deepEqual(await startFight(null, CHAR, 'encounter:knight', { fetch: f }), { offline: 'no-session' });
  assert.equal(calls.length, 0, 'no token, no request');
  for (const [status, why] of [[401, 'http-401'], [403, 'http-403'], [409, 'http-409'], [503, 'http-503']] as const) {
    assert.deepEqual(await startFight('tok', CHAR, 'e', { fetch: recorder(async () => reply(status, { ok: false })).f }), { offline: why });
  }
  for (const body of ['not json', { ok: false }, { ok: true }, { ok: true, result: { ...fight, seed: -1 } }, { ok: true, result: { ...fight, flags: 'x' } }, { ok: true, result: null }]) {
    assert.deepEqual(await startFight('tok', CHAR, 'e', { fetch: recorder(async () => reply(200, body)).f }), { offline: 'bad-reply' }, JSON.stringify(body));
  }
  assert.deepEqual(await startFight('tok', CHAR, 'e', { fetch: (async () => { throw new TypeError('down'); }) as unknown as typeof fetch }), { offline: 'network' });
  const slow = (() => new Promise<Response>(() => {})) as unknown as typeof fetch;   // a fetch that ignores its signal
  assert.deepEqual(await startFight('tok', CHAR, 'e', { fetch: slow, timeoutMs: 20 }), { offline: 'timeout' });
});

test('the readers refuse what is not the writer\'s shape', () => {
  assert.equal(fightOf({ ...fight, token: 5 }), null);
  assert.equal(fightOf({ ...fight, bar: 'x' }), null);
  assert.equal(fightOf({ ...fight, expiresAt: 5 }), null);
  assert.equal(settledOf({ result: 'draw', verified: true, ticks: 1, event: 'e' }), null);
  assert.deepEqual(settledOf({ result: 'lost', verified: false, twist: null, ticks: 0, event: 'enc:x', reason: 'r' }), { result: 'lost', verified: false, twist: null, ticks: 0, event: 'enc:x', reason: 'r' });
});

test('settle packs the record as the server unpacks it, and an unencodable record is an answer', async () => {
  const record = playFight(7, 1)!;
  const { f, calls } = recorder(async () => reply(200, { ok: true, result: { result: 'won', verified: true, twist: null, ticks: record.ticks, event: 'enc:x' } }));
  const got = await settleFight('tok', fight.token, record, { base: '/origins', fetch: f });
  assert.equal(isOffline(got as never), false);
  const sent = JSON.parse(String(calls[0]!.init.body)) as { token: string; record: string };
  assert.deepEqual(Object.keys(sent).sort(), ['record', 'token'], 'the record is the only claim');
  const { gunzipSync } = await import('node:zlib');
  assert.deepEqual(packRecord(unpackRecord(gunzipSync(fromBase64Url(sent.record)))), packRecord(record), 'what the server unpacks packs back to the same bytes');
  assert.deepEqual(await settleFight('tok', fight.token, { ...record, intents: [{ nope: 1 }] } as never, { fetch: f }), { offline: 'bad-record' });
});

// The real writer: createWriter(+ encounterOps with the real verifier) on a loopback port, the same HTTP the page makes.
async function serve(clock: { t: number }) {
  const { db, rows, events } = fakeDb(clock);
  const writer = createWriter({ db, verify: async (t) => (t === 'tok' ? ACCOUNT : null), where: fakeWhere({}), handlers: encounterOps(deps()) });
  await new Promise<void>((ok) => writer.listen(0, '127.0.0.1', ok));
  return { base: `http://127.0.0.1:${(writer.address() as AddressInfo).port}/origins`, rows, events, close: () => new Promise<void>((ok) => writer.close(() => ok())) };
}

test('round trip against the real writer: start -> touch -> play on the server seed -> settle verifies and writes the event once', async () => {
  const clock = { t: 1e6 }, w = await serve(clock);
  try {
    const started = await startFight('tok', CHAR, 'encounter:knight', { base: w.base });
    if ('offline' in started) assert.fail(`the real writer did not start the fight: ${JSON.stringify(started)}`);
    const run = started;   // narrowed to the Fight
    assert.equal(run.enemy, 'knight'); assert.equal(run.level, 6);
    clock.t += 30_000;
    const touched = await touchFight('tok', run.token, 300, { base: w.base });
    assert.equal((touched as { seed: number }).seed, run.seed, 'the same seed continues');
    const record = finishedFight(run.seed, run.level);
    const settled = await settleFight('tok', run.token, record, { base: w.base });
    assert.deepEqual([(settled as { verified: boolean }).verified, (settled as { event: string }).event], [true, `enc:${run.token}`]);
    assert.equal(w.events.length, 1);
    assert.deepEqual(await settleFight('tok', run.token, record, { base: w.base }), { offline: 'http-409' }, 'a replayed settle is refused, nothing written twice');
    assert.equal(w.events.length, 1);
  } finally { await w.close(); }
});

test('round trip: a record played on a seed the server did not issue settles as a verified-false loss; a stranger\'s token and a second open fight are refused', async () => {
  const clock = { t: 1e6 }, w = await serve(clock);
  try {
    const run = await startFight('tok', CHAR, 'encounter:knight', { base: w.base }) as { seed: number; token: string };
    assert.deepEqual(await startFight('tok', CHAR, 'encounter:knight', { base: w.base }), { offline: 'http-409' }, 'one open fight per account: resume the first');
    assert.deepEqual(await startFight('stranger', CHAR, 'encounter:knight', { base: w.base }), { offline: 'http-401' });
    const forged = await settleFight('tok', run.token, finishedFight(run.seed + 1), { base: w.base }) as { verified: boolean; result: string };
    assert.deepEqual([forged.verified, forged.result], [false, 'lost']);
  } finally { await w.close(); }
});
