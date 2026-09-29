// The PvP relay (scripts/duel-relay.mjs) against Node's own WebSocket client: two sides of a room hear each other and nobody else,
// a taken side and a bad room are refused, and the size cap closes an oversized sender.
import assert from 'node:assert/strict';
import test from 'node:test';
import { RELAY, startRelay } from '../scripts/duel-relay.mjs';

type Client = { ws: WebSocket; messages: string[]; closed: Promise<number>; opened: Promise<boolean> };
const connect = (port: number, query: string): Client => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/duel/relay?${query}`), messages: string[] = [];
  ws.onmessage = (e) => messages.push(String(e.data));
  const closed = new Promise<number>((r) => { ws.onclose = (e) => r(e.code); });
  const opened = new Promise<boolean>((r) => { ws.onopen = () => r(true); ws.onerror = () => r(false); });
  return { ws, messages, closed, opened };
};
const until = async (check: () => boolean, ms = 2000) => { const end = Date.now() + ms; while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 10)); return check(); };

test('duel relay: the two sides of a room hear each other, another room hears nothing, and departures are announced', async () => {
  const relay = await startRelay({ port: 0 });
  try {
    const a = connect(relay.port, 'room=abcd1234&side=0'), b = connect(relay.port, 'room=abcd1234&side=1'), c = connect(relay.port, 'room=zzzz9999&side=1');
    assert.ok(await a.opened && await b.opened && await c.opened);
    assert.ok(await until(() => a.messages.includes('{"t":"peer","up":true}') && b.messages.includes('{"t":"peer","up":true}')), 'both sides hear the other arrive');
    a.ws.send('{"t":"pkt","n":1}'); b.ws.send('{"t":"pkt","n":2}');
    assert.ok(await until(() => b.messages.includes('{"t":"pkt","n":1}') && a.messages.includes('{"t":"pkt","n":2}')));
    assert.deepEqual(c.messages, [], 'another room hears nothing');
    assert.deepEqual(relay.stats(), { rooms: 2, sockets: 3 });
    b.ws.close();
    assert.ok(await until(() => a.messages.includes('{"t":"peer","up":false}')), 'the remaining side hears the departure');
    a.ws.close(); c.ws.close();
    assert.ok(await until(() => relay.stats().sockets === 0 && relay.stats().rooms === 0), 'empty rooms are dropped');
  } finally { await relay.close(); }
});

test('duel relay: a taken side, a bad room or side, and an oversized message are refused', async () => {
  const relay = await startRelay({ port: 0 });
  try {
    const a = connect(relay.port, 'room=abcd1234&side=0');
    assert.ok(await a.opened);
    const twin = connect(relay.port, 'room=abcd1234&side=0');
    assert.equal(await twin.closed, 4009, 'a second socket for a taken side is closed 4009');
    for (const query of ['room=AB&side=0', 'room=abcd1234&side=2', 'room=abcd1234']) assert.equal(await connect(relay.port, query).opened, false, `refused: ${query}`);
    a.ws.send('x'.repeat(RELAY.maxMessage + 1));
    assert.equal(await a.closed, 1009, 'an oversized message closes its sender 1009');
  } finally { await relay.close(); }
});
