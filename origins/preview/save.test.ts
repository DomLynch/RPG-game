// The preview's read of the saved career (save.ts): the mapping onto the progression model, and every way the writer can fail -> offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_KEY as GAME_AUTH_KEY } from '../../src/loot-claims.ts';
import { creditFromMarks, levelOfCredit } from '../progression/model.ts';
import { careerLine, nextFight, settle } from '../pit/pit.ts';
import { AUTH_KEY, CHECKING, careerOf, fetchOpen, isOffline, previewCp, saveLine, storedToken, WRITER_PATH, writerBase, type Opened } from './save.ts';

const row = { seed_credit: 5000, world_credit: 700, total_credit: 5700, rested: 12, rested_at: 99, heat: { wolf: { units: 5, at: 9 } }, beaten: ['legend:knight@12'], story: ['s1'], version: 4 };
const reply = (status: number, body: unknown) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const good = { ok: true, result: { marks: 4, career: row, characters: [{ id: 'pc:1', name: 'Aldren', extra: 1 }, { id: 2 }], items: [], quests: [], journal: [], talk: [] } };
function recorder(answer: (url: string, init: RequestInit) => Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return answer(url, init); }) as unknown as typeof fetch;
  return { f, calls };
}

test('the mapped career is the derived total credit, with beaten/story/heat/rested carried, through the server mapping', () => {
  const c = careerOf(row)!;
  assert.equal(c.credit, 5700);
  assert.deepEqual([c.beaten, c.story, c.heat, c.rested, c.restedAt, c.pitWins], [['legend:knight@12'], ['s1'], { wolf: { units: 5, at: 9 } }, 12, 99, 0]);
  assert.equal(careerLine(c).level, levelOfCredit(5700));
  assert.equal(careerLine(c).credit, 5700, 'the HUD shows the total, not the seed');
});

test('a row that is not a career is no career', () => {
  for (const bad of [null, 7, 'x', {}, { ...row, total_credit: '5700' }, { ...row, total_credit: -1 }, { ...row, total_credit: 1.5 }, { ...row, beaten: [1] }, { ...row, story: null }, { ...row, heat: [] }, { ...row, heat: { wolf: { n: 1 } } }, { ...row, rested: NaN }]) {
    assert.equal(careerOf(bad), null, JSON.stringify(bad));
  }
});

test('fetchOpen: POST <base>/open, empty body, the bearer token, nothing else; the reply mapped', async () => {
  const { f, calls } = recorder(async () => reply(200, good));
  const got = await fetchOpen('tok', { base: '/origins', fetch: f });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, '/origins/open');
  assert.equal(calls[0]!.init.method, 'POST');
  assert.equal(calls[0]!.init.body, '{}', 'no duel result, account, reward or amount is ever sent');
  assert.deepEqual(calls[0]!.init.headers, { authorization: 'Bearer tok', 'content-type': 'application/json' });
  assert.ok(!isOffline(got));
  const opened = got as Opened;
  assert.equal(opened.career.credit, 5700);
  assert.deepEqual(opened.characters, [{ id: 'pc:1', name: 'Aldren' }]);
  assert.equal(opened.marks, 4);
});

test('the default base is the one config constant', async () => {
  const { f, calls } = recorder(async () => reply(200, good));
  await fetchOpen('tok', { fetch: f });
  assert.equal(calls[0]!.url, `${WRITER_PATH}/open`);
  assert.equal(WRITER_PATH, '/origins');
});

test('no session: no request at all', async () => {
  const { f, calls } = recorder(async () => reply(200, good));
  assert.deepEqual(await fetchOpen(null, { fetch: f }), { offline: 'no-session' });
  assert.equal(calls.length, 0);
});

for (const status of [401, 403, 404, 409, 500, 503]) {
  test(`HTTP ${status} -> offline, no throw`, async () => {
    const { f } = recorder(async () => reply(status, { ok: false, error: 'x' }));
    assert.deepEqual(await fetchOpen('tok', { fetch: f }), { offline: `http-${status}` });
  });
}

test('an nginx 404 page (not JSON) -> offline', async () => {
  const { f } = recorder(async () => new Response('<html>404</html>', { status: 404 }));
  assert.deepEqual(await fetchOpen('tok', { fetch: f }), { offline: 'http-404' });
});

test('network error -> offline, no throw', async () => {
  const { f } = recorder(async () => { throw new TypeError('fetch failed'); });
  assert.deepEqual(await fetchOpen('tok', { fetch: f }), { offline: 'network' });
});

test('timeout -> offline within the limit, even when the fetch ignores its signal; the signal is aborted', async () => {
  let signal: AbortSignal | undefined;
  const { f } = recorder((_u, init) => { signal = init.signal ?? undefined; return new Promise(() => {}); });
  const t0 = Date.now();
  assert.deepEqual(await fetchOpen('tok', { fetch: f, timeoutMs: 50 }), { offline: 'timeout' });
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(signal?.aborted, true);
});

test('a fetch that honours the abort -> timeout, not network', async () => {
  const { f } = recorder((_u, init) => new Promise((_r, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
  assert.deepEqual(await fetchOpen('tok', { fetch: f, timeoutMs: 30 }), { offline: 'timeout' });
});

test('malformed 200 replies -> offline bad-reply', async () => {
  for (const body of ['not json', { ok: false }, { ok: true }, { ok: true, result: { career: null, characters: [] } }, { ok: true, result: { career: row } }, { ok: true, result: { career: { ...row, total_credit: 'lots' }, characters: [] } }]) {
    const { f } = recorder(async () => reply(200, body));
    assert.deepEqual(await fetchOpen('tok', { fetch: f }), { offline: 'bad-reply' }, JSON.stringify(body));
  }
});

test('writerBase: the constant, or a loopback override only', () => {
  assert.equal(writerBase(''), '/origins');
  assert.equal(writerBase('?writer=http://127.0.0.1:5123/origins'), 'http://127.0.0.1:5123/origins');
  assert.equal(writerBase('?writer=http://localhost:80/origins/'), 'http://localhost:80/origins');
  for (const bad of ['https://evil.example/origins', 'http://127.0.0.1.evil.example:80/origins', 'http://127.0.0.1:80@evil.example/origins', '//evil.example/origins', 'javascript:alert(1)', 'http://127.0.0.1:80/origins?x=1']) {
    assert.equal(writerBase(`?writer=${encodeURIComponent(bad)}`), '/origins', bad);
  }
});

test('storedToken: the live game\'s stored session, unexpired, else none', () => {
  assert.equal(AUTH_KEY, GAME_AUTH_KEY, 'the same key the live game stores its session under');
  const now = 1_000_000_000_000;
  const store = (v: unknown) => ({ getItem: (k: string) => (k === AUTH_KEY ? (typeof v === 'string' ? v : JSON.stringify(v)) : null) });
  assert.equal(storedToken(store({ access_token: 'abc', expires_at: now / 1000 + 3600 }), now), 'abc');
  assert.equal(storedToken(store({ access_token: 'abc', expires_at: now / 1000 - 1 }), now), null, 'expired');
  assert.equal(storedToken(store({ access_token: 'abc', expires_at: now / 1000 + 30 }), now), null, 'about to expire');
  assert.equal(storedToken(store({ access_token: 'abc' }), now), null, 'no expiry');
  assert.equal(storedToken(store({ access_token: 'a b', expires_at: now / 1000 + 3600 }), now), null, 'not a header-safe token');
  assert.equal(storedToken(store('{broken'), now), null);
  assert.equal(storedToken({ getItem: () => null }, now), null);
  assert.equal(storedToken({ getItem: () => { throw new Error('blocked'); } }, now), null);
  assert.equal(storedToken(null, now), null);
});

test('preview wins sit on top of the saved career, counted as preview CP; offline says so', () => {
  const saved = careerOf({ ...row, beaten: [], total_credit: creditFromMarks(4) })!;
  const session = { career: saved, settled: new Set<string>(), fights: 0 };
  const fight = nextFight(session, ['knight', 'pitborn'], 0)!;
  const won = settle(session, fight, 'win', 1000);
  assert.ok(won.award!.cp > 0);
  assert.equal(previewCp({ saved }, won.session.career), won.award!.cp);
  assert.equal(saved.credit, creditFromMarks(4), 'the saved career itself is untouched');
  assert.equal(previewCp({ offline: 'http-404' }, won.session.career), 0);
  assert.equal(saveLine({ offline: 'http-404' }), 'Offline preview: progress is not saved');
  assert.match(saveLine({ saved }), /saved career/);
});

test('the save line is neutral until the read answers, then the real career or the offline line', async () => {
  assert.equal(saveLine(CHECKING), 'Checking saved progress…');
  for (const reason of ['no-session', 'http-403', 'timeout', 'network', 'bad-reply', 'late', 'reset']) assert.equal(saveLine({ offline: reason }), 'Offline preview: progress is not saved', reason);
  const { f } = recorder(() => new Promise(() => {}));
  const answered = await fetchOpen('tok', { fetch: f, timeoutMs: 20 });
  if (!isOffline(answered)) return assert.fail('a timeout is offline');
  assert.equal(saveLine(answered), 'Offline preview: progress is not saved', 'a timeout ends the checking line');
  assert.notEqual(saveLine(answered), saveLine(CHECKING));
});
