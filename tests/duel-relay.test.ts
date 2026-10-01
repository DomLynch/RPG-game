// The PvP relay (scripts/duel-relay.mjs) against Node's own WebSocket client: it is not an open relay (a socket joins only with a signed,
// unexpired token for a minted room, two a room), the caps close abusers, and its log carries counts, never payloads, tokens or IPs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readToken, RELAY, signToken, startRelay, supabaseAdmin } from '../scripts/duel-relay.mjs';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';
type Client = { ws: WebSocket; messages: string[]; closed: Promise<number>; opened: Promise<boolean> };
const connect = (port: number, token: string): Client => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/duel/relay?token=${encodeURIComponent(token)}`), messages: string[] = [];
  ws.onmessage = (e) => messages.push(String(e.data));
  const closed = new Promise<number>((r) => { ws.onclose = (e) => r(e.code); });
  const opened = new Promise<boolean>((r) => { ws.onopen = () => r(true); ws.onerror = () => r(false); });
  return { ws, messages, closed, opened };
};
const mint = async (port: number, ip = '203.0.113.7') => {
  const res = await fetch(`http://127.0.0.1:${port}/duel/relay/room`, { method: 'POST', headers: { 'x-real-ip': ip } });
  return { status: res.status, body: res.status === 200 ? await res.json() as { room: string; tokens: [string, string]; exp: number } : null };
};
const until = async (check: () => boolean, ms = 2000) => { const end = Date.now() + ms; while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 10)); return check(); };

test('duel relay tokens: signed per room and side, and a forged, altered or expired one reads as nothing', () => {
  const exp = Date.now() + 60_000, token = signToken(SECRET, 'abcdefgh12345678', 1, exp);
  assert.deepEqual(readToken(SECRET, token), { room: 'abcdefgh12345678', side: 1 });
  assert.equal(readToken('another-secret-that-is-32-characters-long!', token), null, 'another secret');
  assert.equal(readToken(SECRET, token.replace('.1.', '.0.')), null, 'the side altered');
  assert.equal(readToken(SECRET, signToken(SECRET, 'abcdefgh12345678', 0, Date.now() - 1)), null, 'expired');
  for (const bad of ['', 'a.b.c', 'ABCDEFGH12345678.0.1790000000000.x', undefined]) assert.equal(readToken(SECRET, bad), null);
});

test('duel relay: the two sides of a minted room hear each other, another room hears nothing, and the log is counts only', async () => {
  const lines: string[] = [];
  const relay = await startRelay({ port: 0, secret: SECRET, log: (l: string) => lines.push(l), logEveryMs: 50 });
  try {
    const one = (await mint(relay.port)).body!, two = (await mint(relay.port)).body!;
    const a = connect(relay.port, one.tokens[0]), b = connect(relay.port, one.tokens[1]), c = connect(relay.port, two.tokens[1]);
    assert.ok(await a.opened && await b.opened && await c.opened);
    assert.ok(await until(() => a.messages.includes('{"t":"peer","up":true}') && b.messages.includes('{"t":"peer","up":true}')), 'both sides hear the other arrive');
    a.ws.send('{"t":"pkt","secret-payload":1}'); b.ws.send('{"t":"pkt","n":2}');
    assert.ok(await until(() => b.messages.includes('{"t":"pkt","secret-payload":1}') && a.messages.includes('{"t":"pkt","n":2}')));
    assert.deepEqual(c.messages, [], 'another room hears nothing');
    assert.ok(await until(() => lines.some((l) => /messages [1-9]/.test(l))), 'a counts line was logged');
    for (const l of lines) for (const leak of ['secret-payload', one.tokens[0], one.room, '203.0.113.7']) assert.ok(!l.includes(leak), `the log never carries ${leak}`);
    b.ws.close();
    assert.ok(await until(() => a.messages.includes('{"t":"peer","up":false}')), 'the remaining side hears the departure');
    a.ws.close(); c.ws.close();
    assert.ok(await until(() => relay.stats().sockets === 0 && relay.stats().rooms === 0), 'empty rooms are dropped');
  } finally { await relay.close(); }
});

test('duel relay: no token, a forged token, an oversized message and a mint flood are refused', async () => {
  const relay = await startRelay({ port: 0, secret: SECRET, log: () => undefined });
  try {
    const { tokens, room, exp } = (await mint(relay.port)).body!;
    const a = connect(relay.port, tokens[0]);
    assert.ok(await a.opened);
    assert.equal(await connect(relay.port, '').opened, false, 'no token');
    assert.equal(await connect(relay.port, signToken('forged-secret-that-is-32-characters-long', room, 1, exp)).opened, false, 'a forged token');
    assert.equal(relay.stats().sockets, 1);
    a.ws.send('x'.repeat(RELAY.maxMessage + 1));
    assert.equal(await a.closed, 1009, 'an oversized message closes its sender 1009');
    const statuses = [];
    for (let i = 0; i <= RELAY.ipMintsPerMinute; i++) statuses.push((await mint(relay.port, '198.51.100.9')).status);
    assert.deepEqual(statuses.slice(-2), [200, 429], `one IP gets ${RELAY.ipMintsPerMinute} rooms a minute`);
    assert.equal((await mint(relay.port, '198.51.100.10')).status, 200, 'another IP is not affected');
  } finally { await relay.close(); }
});

test('duel relay: it will not start without a real secret', () => {
  assert.throws(() => startRelay({ port: 0, secret: 'short' }), /DUEL_RELAY_SECRET/);
  assert.throws(() => startRelay({ port: 0, secret: undefined }), /DUEL_RELAY_SECRET/);
});

test('duel relay: minting is admins-only when a check is set; a missing or refused session mints nothing', async () => {
  const GOOD = 'Bearer admin.session.token-000000000000';
  const relay = await startRelay({ port: 0, secret: SECRET, log: () => {}, admit: async (auth?: string) => auth === GOOD });
  const post = (headers: Record<string, string>) => fetch(`http://127.0.0.1:${relay.port}/duel/relay/room`, { method: 'POST', headers: { 'x-real-ip': '203.0.113.9', ...headers } });
  try {
    assert.equal((await post({})).status, 401, 'no session');
    assert.equal((await post({ authorization: 'Bearer someone.else.token-0000000000000' })).status, 403, 'not on the roster');
    assert.equal(relay.stats().rooms, 0);
    const ok = await post({ authorization: GOOD });
    assert.equal(ok.status, 200);
    assert.equal(((await ok.json()) as { tokens: string[] }).tokens.length, 2);
  } finally { await relay.close(); }
});

test('supabaseAdmin: one own admins row is an admin; no bearer asks nothing; an empty or failed answer is not', async () => {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const answer = (status: number, body: unknown) => (async (url: string, init: { headers: Record<string, string> }) => { calls.push({ url, headers: init.headers }); return new Response(JSON.stringify(body), { status }); }) as unknown as typeof fetch;
  const bearer = 'Bearer eyJhbGciOi.payload-part-000.signature';
  assert.equal(await supabaseAdmin('https://db.example', 'anon', answer(200, [{ user_id: 'u' }]))(bearer), true);
  assert.equal(calls[0].url, 'https://db.example/rest/v1/admins?select=user_id&limit=1');
  assert.equal(calls[0].headers.authorization, bearer, "the caller's own session, so RLS returns only its own row");
  assert.equal(await supabaseAdmin('https://db.example', 'anon', answer(200, []))(bearer), false);
  assert.equal(await supabaseAdmin('https://db.example', 'anon', answer(401, { message: 'JWT expired' }))(bearer), false);
  const before = calls.length;
  for (const bad of [undefined, '', 'Basic abc', 'Bearer short', `Bearer ${'x'.repeat(30)}\nX: y`]) assert.equal(await supabaseAdmin('https://db.example', 'anon', answer(200, [{}]))(bad as string), false);
  assert.equal(calls.length, before, 'a malformed header never reaches Supabase');
});

test('duel relay with the real Supabase check: an authenticated non-admin (RLS returns no admins row) gets 403 and mints nothing', async () => {
  const asked: string[] = [];
  const noRow = (async (_url: string, init: { headers: Record<string, string> }) => { asked.push(init.headers.authorization); return new Response('[]', { status: 200 }); }) as unknown as typeof fetch;
  const relay = await startRelay({ port: 0, secret: SECRET, log: () => {}, admit: supabaseAdmin('https://db.example', 'anon', noRow) });
  const bearer = 'Bearer eyJhbGciOi.signed-in-player-000.signature';
  try {
    const res = await fetch(`http://127.0.0.1:${relay.port}/duel/relay/room`, { method: 'POST', headers: { 'x-real-ip': '203.0.113.11', authorization: bearer } });
    assert.equal(res.status, 403);
    assert.deepEqual(asked, [bearer], "Supabase was asked once, with the caller's own session");
    assert.equal(relay.stats().rooms, 0);
  } finally { await relay.close(); }
});

// Reconnect (Strategy 2026-10-01): a dropped player has ~10 s to come back. The token is that player's secret, so its holder returning takes
// the side over at once (a network switch leaves a half-open socket the relay cannot tell is dead); the peer hears a fresh `up`, never a
// `down` it would turn into a forfeit; and every socket hears a beat, which is how a page knows its own link is the healthy one.
test('duel relay: a token holder coming back takes its side over; the peer is told it is up again, and the old socket is dropped', async () => {
  const relay = await startRelay({ port: 0, secret: SECRET, log: () => undefined });
  try {
    const { tokens } = (await mint(relay.port)).body!;
    const a = connect(relay.port, tokens[0]), b = connect(relay.port, tokens[1]);
    assert.ok(await a.opened && await b.opened);
    assert.ok(await until(() => b.messages.includes('{"t":"peer","up":true}')));
    b.messages.length = 0;
    const again = connect(relay.port, tokens[0]);
    assert.ok(await again.opened, 'the same token again is let in');
    await a.closed;
    assert.deepEqual(b.messages.filter((m) => m.includes('"peer"')), ['{"t":"peer","up":true}'], 'the peer hears an arrival and no departure');
    assert.equal(relay.stats().sockets, 2, 'two sockets, not three: the old one is gone');
    b.ws.send('{"t":"pkt","n":1}');
    assert.ok(await until(() => again.messages.includes('{"t":"pkt","n":1}')), 'packets reach the new socket');
    for (const c of [again, b]) c.ws.close();
  } finally { await relay.close(); }
});

test('duel relay: a dropped side is told to its peer as down, and coming back inside the window is up again with the same token', async () => {
  const relay = await startRelay({ port: 0, secret: SECRET, log: () => undefined });
  try {
    const { room, tokens } = (await mint(relay.port)).body!;
    const a = connect(relay.port, tokens[0]), b = connect(relay.port, tokens[1]);
    assert.ok(await a.opened && await b.opened);
    assert.ok(await until(() => a.messages.includes('{"t":"peer","up":true}')));
    a.messages.length = 0;
    assert.equal(relay.kick(room, 1), true, 'the guest\'s socket is cut');
    assert.ok(await until(() => a.messages.includes('{"t":"peer","up":false}')), 'the challenger hears the guest is gone');
    const back = connect(relay.port, tokens[1]);
    assert.ok(await back.opened);
    assert.ok(await until(() => a.messages.includes('{"t":"peer","up":true}') && back.messages.includes('{"t":"peer","up":true}')), 'both hear it is up again');
    assert.equal(relay.kick('zzzzzzzzzzzzzzzz', 0), false);
    for (const c of [a, back]) c.ws.close();
  } finally { await relay.close(); }
});

test('duel relay: every connected socket hears a beat, so a page can tell its own link is up', async () => {
  const relay = await startRelay({ port: 0, secret: SECRET, log: () => undefined });
  try {
    const { tokens } = (await mint(relay.port)).body!;
    const a = connect(relay.port, tokens[0]);
    assert.ok(await a.opened);
    assert.ok(await until(() => a.messages.includes('{"t":"beat"}'), RELAY.beatMs * 2 + 1000), 'a lone socket hears a beat');
    a.ws.close();
  } finally { await relay.close(); }
});
