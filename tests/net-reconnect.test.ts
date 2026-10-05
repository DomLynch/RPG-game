// The relay socket's retry schedule (src/net/transport.ts), driven with a fake WebSocket and mock timers: the Auditor's B1 (a link back
// before the page forfeits must be heard before it does) and B2 (a failed connect fires error then close: one backoff step, not two).
import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { SILENCE } from '../src/net/pvp.ts';
import { connectDuel, RECONNECT } from '../src/net/transport.ts';

class FakeSocket {
  static OPEN = 1; static instances: FakeSocket[] = [];
  readyState = 0; sent: string[] = [];
  onopen: (() => void) | null = null; onmessage: ((e: { data: string }) => void) | null = null; onerror: ((e: unknown) => void) | null = null; onclose: ((e: { code?: number }) => void) | null = null;
  readonly url: string;
  constructor(url: string) { this.url = url; FakeSocket.instances.push(this); }
  send(text: string) { this.sent.push(text); }
  close() { this.readyState = 3; }
  open() { this.readyState = 1; this.onopen?.(); }
  fail() { this.readyState = 3; this.onerror?.({}); this.onclose?.({ code: 1006 }); }   // a failed connect: error, then close
}

const TOKEN = 'abcdefgh.0.9999999999999';
async function withFakes(run: (clock: { tick: (ms: number) => void; now: () => number }) => Promise<void>): Promise<void> {
  const real = globalThis.WebSocket, random = Math.random, base = RECONNECT.retryMs;
  FakeSocket.instances = [];
  (globalThis as { WebSocket: unknown }).WebSocket = FakeSocket;
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  try { await run({ tick: (ms) => mock.timers.tick(ms), now: () => Date.now() }); }
  finally { mock.timers.reset(); (globalThis as { WebSocket: unknown }).WebSocket = real; Math.random = random; RECONNECT.retryMs = base; }
}
// A connected page: the first socket opens and the peer is up, so the path is decided and a later loss is retried.
async function connected() {
  const pending = connectDuel(TOKEN, { url: 'ws://relay', direct: false });
  const first = FakeSocket.instances[0]; first.open(); first.onmessage?.({ data: JSON.stringify({ t: 'peer', up: true }) });
  return { transport: await pending, first };
}

test('reconnect: a failed connect (error then close) takes one backoff step, not two', async () => {
  await withFakes(async ({ tick }) => {
    Math.random = () => 0.5;   // jitter 1.0x: attempt n waits retryMs * 2^(n-1)
    RECONNECT.retryMs = 100;
    const { first, transport } = await connected();
    first.fail();   // attempt 1: 100 ms
    assert.equal(FakeSocket.instances.length, 1);
    tick(99); assert.equal(FakeSocket.instances.length, 1, 'not before the first step');
    tick(1); assert.equal(FakeSocket.instances.length, 2, 'the first retry lands at one step (100 ms), not at two (200 ms)');
    FakeSocket.instances[1].fail();   // attempt 2: 200 ms
    tick(199); assert.equal(FakeSocket.instances.length, 2);
    tick(1); assert.equal(FakeSocket.instances.length, 3, 'and the second at 200 ms: two events per failure counted once');
    transport.close();
  });
});

test('reconnect: a relay outage that ends at 8 s is heard again before the page forfeits at SILENCE.rejoinMs (retries at 0.5, 1.5, 3.5, 7.5 s would miss it)', async () => {
  await withFakes(async ({ tick, now }) => {
    Math.random = () => 0.5;   // jitter 1.0x: the plain doubling schedule, 0.5 / 1.5 / 3.5 / 7.5 / 11.5 s with a 4 s cap
    const { first, transport } = await connected();
    const lostAt = now(), outageEnd = lostAt + 8000;
    first.fail();
    let opened: number | null = null, seen = 1;
    while (opened === null && now() - lostAt < RECONNECT.reconnectMs) {
      tick(10);
      while (seen < FakeSocket.instances.length) {
        const socket = FakeSocket.instances[seen++];
        if (now() < outageEnd) socket.fail(); else { socket.open(); opened = now() - lostAt; }
      }
    }
    assert.ok(opened !== null && opened < SILENCE.rejoinMs, `back at ${opened} ms after the loss, before the page forfeits at ${SILENCE.rejoinMs} ms`);
    transport.close();
  });
});

test('reconnect: a final close from the relay (4001) is not retried, even after an error scheduled a retry', async () => {
  await withFakes(async ({ tick }) => {
    const { first, transport } = await connected();
    first.onerror?.({}); first.onclose?.({ code: 4001 });
    tick(RECONNECT.reconnectMs); assert.equal(FakeSocket.instances.length, 1);
    transport.close();
  });
});
