// The transport's reconnect (Strategy 2026-10-01) against the real relay and Node's own WebSocket: a dropped relay socket is retried with the
// same token, the peer is told down and then up, packets flow again, and `link()` is the relay's beats (down while cut, up once they come back).
// `direct: false` never builds a peer connection, so everything here rides the relay.
import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { RELAY, startRelay } from '../scripts/duel-relay.mjs';
import { connectDuel, mintRoom, RECONNECT, type Transport } from '../src/net/transport.ts';
import type { DuelMessage } from '../src/net/pvp.ts';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';
const until = async (check: () => boolean, ms = 4000) => { const end = Date.now() + ms; while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 10)); return check(); };
const ping = (n: number): DuelMessage => ({ k: 'ping', n, r: 'room' });

// Browser operations are deferred here to drive interleavings the real-relay tests below cannot control.
const deferred = () => {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
type Stage = 'offer' | 'remote' | 'answer' | 'local' | 'stats';
type Gates = Partial<Record<Stage, ReturnType<typeof deferred>>>;
const flushed = () => new Promise<void>((resolve) => setImmediate(resolve));
async function browserTransport(t: TestContext, side: 0 | 1, gates: Gates = {}) {
  const sockets: Socket[] = [], peers: Peer[] = [];
  class Socket {
    static OPEN = 1;
    readyState = 1;
    sent: unknown[] = [];
    onmessage: ((e: MessageEvent) => void) | null = null;
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() { sockets.push(this); }
    send(raw: string) { this.sent.push(JSON.parse(raw)); }
    receive(message: unknown) { this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent); }
    close() { this.readyState = 3; this.onclose?.(); }
  }
  class Channel {
    readyState = 'connecting';
    sent: string[] = [];
    onopen: (() => void) | null = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onclose: (() => void) | null = null;
    send(raw: string) { this.sent.push(raw); }
    open() { this.readyState = 'open'; this.onopen?.(); }
    close() { this.readyState = 'closed'; this.onclose?.(); }
  }
  class Peer {
    id = peers.length;
    gates = peers.length === 0 ? gates : {} as Gates;
    channel = new Channel();
    locals: RTCSessionDescriptionInit[] = [];
    answers = 0;
    closed = false;
    localDescription: { toJSON(): RTCSessionDescriptionInit } | null = null;
    onicecandidate: ((e: RTCPeerConnectionIceEvent) => void) | null = null;
    ondatachannel: ((e: RTCDataChannelEvent) => void) | null = null;
    constructor() { peers.push(this); }
    createDataChannel() { return this.channel; }
    async createOffer() { await this.gates.offer?.promise; return { type: 'offer' as const, sdp: `offer-${this.id}` }; }
    async setRemoteDescription() { await this.gates.remote?.promise; }
    async createAnswer() { this.answers++; await this.gates.answer?.promise; return { type: 'answer' as const, sdp: `answer-${this.id}` }; }
    async setLocalDescription(sdp: RTCSessionDescriptionInit) {
      this.locals.push(sdp); await this.gates.local?.promise;
      this.localDescription = { toJSON: () => sdp };
    }
    async addIceCandidate() {}
    async getStats() { await this.gates.stats?.promise; return new Map(); }
    close() { this.closed = true; this.channel.close(); }
  }
  const originalSocket = globalThis.WebSocket, originalPeer = globalThis.RTCPeerConnection;
  globalThis.WebSocket = Socket as unknown as typeof WebSocket;
  globalThis.RTCPeerConnection = Peer as unknown as typeof RTCPeerConnection;
  t.after(() => {
    transport?.close();
    globalThis.WebSocket = originalSocket; globalThis.RTCPeerConnection = originalPeer;
  });
  const connecting = connectDuel(`room.${side}.token`, { url: 'ws://test', directMs: 5 });
  const socket = sockets[0]!;
  const arrive = () => socket.receive(side === 0 ? { t: 'peer', up: true } : { t: 'sig', sdp: { type: 'offer', sdp: 'remote-offer' } });
  arrive();
  const transport = await connecting;
  return { transport, socket, peers, arrive };
}

for (const [side, stages] of [[0, ['offer', 'local']], [1, ['remote', 'answer', 'local']]] as const) {
  for (const stage of stages) {
    test(`transport: replaced side ${side} cannot resume ${stage} setup on the new peer`, async (t) => {
      const gate = deferred();
      const { transport, socket, peers, arrive } = await browserTransport(t, side, { [stage]: gate });
      arrive(); await flushed();
      const expected = [{ t: 'sig', sdp: { type: side === 0 ? 'offer' : 'answer', sdp: `${side === 0 ? 'offer' : 'answer'}-1` } }];
      assert.deepEqual(socket.sent, expected);
      gate.resolve(); await flushed();
      assert.deepEqual(socket.sent, expected, 'the retired setup must emit no late SDP');
      assert.equal(peers[1]!.locals.length, 1, 'the replacement receives only its own description');
      assert.equal(transport.path, 'relay');
    });
    test(`transport: closed side ${side} ignores pending ${stage} setup`, async (t) => {
      const gate = deferred();
      const { transport, peers } = await browserTransport(t, side, { [stage]: gate });
      const before = [peers[0]!.locals.length, peers[0]!.answers];
      transport.close(); gate.resolve(); await flushed();
      assert.deepEqual([peers[0]!.locals.length, peers[0]!.answers], before, 'no next WebRTC operation after close');
      assert.equal(transport.path, 'relay');
    });
    test(`transport: rejected side ${side} ${stage} setup retains usable relay`, async (t) => {
      const gate = deferred();
      const { transport, socket, peers } = await browserTransport(t, side, { [stage]: gate });
      gate.reject(new Error(`rejected ${stage}`)); await flushed();
      transport.send(ping(7));
      assert.deepEqual(socket.sent, [{ t: 'pkt', p: JSON.stringify(ping(7)) }]);
      assert.equal(transport.path, 'relay');
      assert.equal(peers[0]!.closed, true, 'failed setup releases its peer connection');
    });
  }
}

test('transport: a retired setup rejection cannot close the replacement', async (t) => {
  const gate = deferred();
  const { transport, peers, arrive } = await browserTransport(t, 0, { offer: gate });
  arrive(); await flushed();
  peers[1]!.channel.open(); await flushed();
  assert.equal(transport.path, 'direct');
  gate.reject(new Error('retired offer')); await flushed();
  assert.equal(transport.path, 'direct');
  assert.equal(peers[1]!.closed, false);
  transport.send(ping(10));
  assert.deepEqual(peers[1]!.channel.sent, [JSON.stringify(ping(10))]);
});

test('transport: rejected remote answer on challenger falls back without an unhandled rejection', async (t) => {
  const gate = deferred();
  const { transport, socket, peers } = await browserTransport(t, 0, { remote: gate });
  socket.receive({ t: 'sig', sdp: { type: 'answer', sdp: 'remote-answer' } });
  gate.reject(new Error('bad answer')); await flushed();
  assert.equal(peers[0]!.closed, true);
  socket.sent.length = 0; transport.send(ping(11));
  assert.deepEqual(socket.sent, [{ t: 'pkt', p: JSON.stringify(ping(11)) }]);
});

test('transport: queued relay and retired channel events cannot revive a closed transport', async (t) => {
  const { transport, socket, peers, arrive } = await browserTransport(t, 0);
  const received: string[] = [];
  transport.onMessage = (raw) => received.push(raw);
  transport.close();
  arrive(); socket.receive({ t: 'pkt', p: 'late-relay' });
  peers[0]!.channel.onmessage?.({ data: 'late-direct' } as MessageEvent);
  peers[0]!.channel.open(); await flushed();
  assert.equal(peers.length, 1);
  assert.deepEqual(received, []);
  assert.equal(transport.path, 'relay');
});

test('transport: delayed channel stats cannot promote a replaced or closed channel', async (t) => {
  const gate = deferred();
  const { transport, peers, arrive } = await browserTransport(t, 0, { stats: gate });
  peers[0]!.channel.open();
  arrive(); await flushed();
  gate.resolve(); await flushed();
  assert.equal(transport.path, 'relay', 'retired channel cannot select direct');
  const secondStats = deferred(); peers[1]!.gates.stats = secondStats;
  peers[1]!.channel.open(); transport.close(); secondStats.resolve(); await flushed();
  assert.equal(transport.path, 'relay', 'closed channel cannot select direct');
});

test('transport: current channel opens direct even when optional stats fail, and close returns to relay', async (t) => {
  const gate = deferred();
  const { transport, socket, peers } = await browserTransport(t, 0, { stats: gate });
  socket.sent.length = 0;
  peers[0]!.channel.open(); gate.reject(new Error('stats unavailable')); await flushed();
  assert.equal(transport.path, 'direct');
  transport.send(ping(8));
  assert.deepEqual(peers[0]!.channel.sent, [JSON.stringify(ping(8))]);
  peers[0]!.channel.close();
  assert.equal(transport.path, 'relay');
  socket.sent.length = 0; transport.send(ping(9));
  assert.deepEqual(socket.sent, [{ t: 'pkt', p: JSON.stringify(ping(9)) }]);
});

for (const failure of ['offer', 'local'] as const) {
  test(`transport: both ends use relay when challenger ${failure} fails before emitting an offer`, async () => {
    const originalPeer = globalThis.RTCPeerConnection;
    class FailedOfferPeer {
      createDataChannel() { return { close() {} }; }
      async createOffer() {
        if (failure === 'offer') throw new Error('offer failed');
        return { type: 'offer' as const, sdp: 'unsent-offer' };
      }
      async setLocalDescription() { throw new Error('local description failed'); }
      close() {}
    }
    globalThis.RTCPeerConnection = FailedOfferPeer as unknown as typeof RTCPeerConnection;
    const relay = await startRelay({ port: 0, secret: SECRET, log: () => undefined });
    const transports: Transport[] = [], connections: Promise<void>[] = [];
    try {
      const room = await mintRoom(null, `http://127.0.0.1:${relay.port}`);
      for (const token of room.tokens) {
        connections.push(connectDuel(token, { url: `ws://127.0.0.1:${relay.port}/duel/relay`, directMs: 10 })
          .then((transport) => { transports.push(transport); }, () => undefined));
      }
      assert.ok(await until(() => transports.length === 2, 1000), 'both connections resolve even though no SDP reaches the guest');
      assert.deepEqual(transports.map((transport) => transport.path), ['relay', 'relay']);
      const heard: string[][] = [[], []];
      transports.forEach((transport, i) => { transport.onMessage = (raw) => heard[i]!.push(raw); });
      transports[0]!.send(ping(12)); transports[1]!.send(ping(13));
      assert.ok(await until(() => heard[0]!.length === 1 && heard[1]!.length === 1));
      assert.deepEqual(heard, [[JSON.stringify(ping(13))], [JSON.stringify(ping(12))]]);
    } finally {
      transports.forEach((transport) => transport.close());
      await relay.close(); await Promise.all(connections);
      globalThis.RTCPeerConnection = originalPeer;
    }
  });
}

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
