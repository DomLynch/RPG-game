// src/fight/open.ts: the page's one writer `open`. One request per page and storage, a slow answer is asked again (Dom's first /zone1/ visit timed out while the writer was still creating his
// character), a refusal is final, and a failure is not kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openAccount, openCharacter } from '../src/fight/open.ts';

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
