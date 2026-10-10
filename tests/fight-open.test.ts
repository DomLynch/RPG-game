// src/core/open.ts: the page's one writer `open`. One request per page and storage, a slow answer is asked again (Dom's first /zone1/ visit timed out while the writer was still creating his
// character), a refusal is final, and a failure is not kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import { characterFor, openAccount, openCharacter } from '../src/core/open.ts';
import { spawnTracker } from '../origins/preview/spawn-net.ts';

const token = () => ({ getItem: () => JSON.stringify({ access_token: 'tok', expires_at: Date.now() / 1000 + 3600 }) });
const ok = (id = 'pc:1') => new Response(JSON.stringify({ ok: true, result: { characters: [{ id, name: 'Wanderer' }] } }), { status: 200 });
const scripted = (...steps: (() => Promise<Response>)[]) => { let n = 0; const f = (async () => steps[Math.min(n++, steps.length - 1)]!()) as unknown as typeof fetch; return { f, calls: () => n }; };
const never = () => new Promise<Response>(() => {});
const fast = { retryMs: 1, timeoutMs: 20 };

test('a timeout is asked again and finds the character; the page made one logical open', async () => {
  const w = scripted(never, async () => ok('pc:abc'));
  assert.equal(await openCharacter({ storage: token(), search: '', fetch: w.f, ...fast }), 'pc:abc');
  assert.equal(w.calls(), 2);
});

test('a dropped connection and a 5xx are asked again; three bad answers in a row end offline', async () => {
  const w = scripted(async () => { throw new Error('down'); }, async () => new Response('', { status: 502 }), async () => ok('pc:2'));
  assert.equal(await openCharacter({ storage: token(), search: '', fetch: w.f, ...fast }), 'pc:2');
  const dead = scripted(never);
  assert.deepEqual(await openAccount({ storage: token(), search: '', fetch: dead.f, ...fast }), { offline: 'timeout' });
  assert.equal(dead.calls(), 3, 'one try and two retries');
});

test('a refusal is final: 401, 403, 404 and 503 (not installed) are not asked again', async () => {
  for (const status of [401, 403, 404, 503]) {
    const w = scripted(async () => new Response('', { status }));
    assert.deepEqual(await openAccount({ storage: token(), search: '', fetch: w.f, ...fast }), { offline: `http-${status}` });
    assert.equal(w.calls(), 1, String(status));
  }
});

test('one request per storage: every caller shares the answer; a failure is not kept; a guest asks nothing', async () => {
  const storage = token();
  const w = scripted(async () => ok('pc:9'));
  const [a, b] = await Promise.all([openCharacter({ storage, search: '', fetch: w.f }), openCharacter({ storage, search: '', fetch: w.f })]);
  assert.deepEqual([a, b, w.calls()], ['pc:9', 'pc:9', 1]);
  assert.equal(await openCharacter({ storage, search: '', fetch: w.f }), 'pc:9');
  assert.equal(w.calls(), 1, 'a later caller (the gear sheet) reads the same answer');
  const flaky = scripted(async () => new Response('', { status: 401 }), async () => ok('pc:3'));
  const s2 = token();
  assert.equal(await openCharacter({ storage: s2, search: '', fetch: flaky.f, ...fast }), null);
  assert.equal(await openCharacter({ storage: s2, search: '', fetch: flaky.f, ...fast }), 'pc:3', 'the refusal was not kept');
  const guest = scripted(async () => ok());
  assert.equal(await openCharacter({ storage: null, search: '', fetch: guest.f }), null);
  assert.equal(guest.calls(), 0);
});

test('the first open times out, the second succeeds, and then the kill is reported', async () => {
  const seen: string[] = []; let opens = 0;
  const f = (async (url: string) => {
    const op = String(url).split('/').pop()!; seen.push(op);
    if (op === 'open') return ++opens === 1 ? new Promise<Response>(() => {}) : ok('pc:77');
    if (op === 'engage') return new Response(JSON.stringify({ ok: true, result: { token: 'T', instance: 'z1:wolf:1', generation: 1, kind: 'wolf', level: 1, hp: 10, expiresAt: '2026-10-09T20:00:00Z' } }), { status: 200 });
    if (op === 'kill_report') return new Response(JSON.stringify({ ok: true, result: { result: 'killed', instance: 'z1:wolf:1', respawnAt: null, loot: [], cp: 5, bronze: 3 } }), { status: 200 });
    return new Response('{}', { status: 404 });
  }) as unknown as typeof fetch;
  const storage = token(); let characterId: string | null = null;
  const deps = { storage, search: '', fetch: f, retries: 0, timeoutMs: 20 };
  assert.equal(await openCharacter(deps), null, 'the page-load open timed out: no character id');
  const tracker = spawnTracker({ token: () => 'tok', character: characterFor(deps, () => characterId, (id) => { characterId = id; }), now: () => Date.now(), fetch: f, timeoutMs: 200 });
  const engaged = await tracker.engaged('z1:wolf:1');
  assert.ok(!('offline' in engaged), 'the engage re-asked the door, found the character and went through');
  tracker.hit('z1:wolf:1');
  const killed = await tracker.killed('z1:wolf:1');
  assert.ok(!('offline' in killed));
  assert.equal(characterId, 'pc:77');
  assert.deepEqual(seen, ['open', 'open', 'engage', 'kill_report']);
});
