// The transport's reconnect (Strategy 2026-10-01) against the real relay and Node's own WebSocket: a dropped relay socket is retried with the
// same token, the peer is told down and then up, packets flow again, and `link()` is the relay's beats (down while cut, up once they come back).
// `direct: false` never builds a peer connection, so everything here rides the relay.
import assert from 'node:assert/strict';
import test from 'node:test';
import { RELAY, startRelay } from '../scripts/duel-relay.mjs';
import { connectDuel, mintRoom, RECONNECT, type Transport } from '../src/net/transport.ts';
import type { DuelMessage } from '../src/net/pvp.ts';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';
const until = async (check: () => boolean, ms = 4000) => { const end = Date.now() + ms; while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 10)); return check(); };
const ping = (n: number): DuelMessage => ({ k: 'ping', n, r: 'room' });

test('transport: guest and refused sign-in prompt login without claiming duels are admin-only', async () => {
  const relay = await startRelay({ port: 0, secret: SECRET, log: () => undefined, admit: async () => false, players: async () => null });
  try {
    const origin = `http://127.0.0.1:${relay.port}`;
    for (const session of [null, 'refused-test-session']) {
      await assert.rejects(mintRoom(session, origin), { message: 'Sign in to challenge a friend' });
    }
  } finally { await relay.close(); }
});

test('transport: a cut relay socket is retried with the same token; the peer hears down then up, packets flow again, and link() follows the beats', async () => {
  const beat = RELAY.beatMs, retry = RECONNECT.retryMs;
  RELAY.beatMs = 50; RECONNECT.retryMs = 300;   // a down window long enough to observe, short enough for a test
  const relay = await startRelay({ port: 0, secret: SECRET, log: () => undefined });
  try {
    const res = await fetch(`http://127.0.0.1:${relay.port}/duel/relay/room`, { method: 'POST', headers: { 'x-real-ip': '203.0.113.50' } });
    const { room, tokens } = await res.json() as { room: string; tokens: [string, string] };
    const url = `ws://127.0.0.1:${relay.port}/duel/relay`;
    const a = connectDuel(tokens[0], { url, direct: false }), b = connectDuel(tokens[1], { url, direct: false });
    const [ta, tb]: Transport[] = await Promise.all([a, b]);
    const heardByA: string[] = [], peerOfA: boolean[] = [];
    ta.onMessage = (m) => heardByA.push(m); ta.onPeer = (up) => peerOfA.push(up);
    assert.ok(await until(() => ta.link() === true && tb.link() === true), 'both links report up once the beats arrive');
    tb.send(ping(1));
    assert.ok(await until(() => heardByA.length === 1), 'a packet crosses the relay');

    assert.deepEqual([ta.reconnects, tb.reconnects], [0, 0], 'neither page has dropped yet');
    assert.equal(relay.kick(room, 1), true, 'the guest\'s relay socket is cut');
    assert.ok(await until(() => peerOfA.at(-1) === false), 'the challenger is told the guest is gone');
    assert.ok(await until(() => tb.link() === false, 250), 'the guest knows its own link is down');
    assert.ok(await until(() => peerOfA.at(-1) === true && tb.link() === true, 6000), 'the guest is back inside the window with the same token, and the challenger is told');
    assert.deepEqual([ta.reconnects, tb.reconnects], [0, 1], 'only the page whose own socket dropped counts a reconnect');
    tb.send(ping(2));
    assert.ok(await until(() => heardByA.length === 2), 'packets flow again after the reconnect');
    ta.close(); tb.close();
  } finally { RELAY.beatMs = beat; RECONNECT.retryMs = retry; await relay.close(); }
});

test('transport: with no beat ever heard (an older relay) link() is unknown, never up', async () => {
  const beat = RELAY.beatMs;
  RELAY.beatMs = 3_600_000;   // the relay never beats inside this test
  const relay = await startRelay({ port: 0, secret: SECRET, log: () => undefined });
  try {
    const res = await fetch(`http://127.0.0.1:${relay.port}/duel/relay/room`, { method: 'POST', headers: { 'x-real-ip': '203.0.113.51' } });
    const { tokens } = await res.json() as { tokens: [string, string] };
    const url = `ws://127.0.0.1:${relay.port}/duel/relay`;
    const [ta, tb] = await Promise.all([connectDuel(tokens[0], { url, direct: false }), connectDuel(tokens[1], { url, direct: false })]);
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(ta.link(), null); assert.equal(tb.link(), null);
    ta.close(); tb.close();
  } finally { RELAY.beatMs = beat; await relay.close(); }
});
