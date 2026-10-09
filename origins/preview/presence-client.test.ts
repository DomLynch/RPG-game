// The preview's presence join (presence-client.ts): no token, no socket; the token rides the subprotocol; no pose before the server's hello; the pose is the 8-byte wire frame in presence centimetres;
// a lost socket is retried on the jittered schedule and given up on when the service never answers; stop() closes cleanly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeUp, encodeDown } from '../presence/wire.ts';
import { CENTRE_CM, GIVE_UP_AFTER, headingByte, joinPresence, PROTOCOL, presenceUrl, presenceWanted, type Socket } from './presence-client.ts';

type Fake = Socket & { sent: Uint8Array[]; closed: number | null; calls: { url: string; protocols: string[] } };
function rig(over: { token?: string | null } = {}) {
  const sockets: Fake[] = [];
  const timers: { fn: () => void; ms: number; live: boolean }[] = [];
  const ticks: (() => void)[] = [];
  const hello: unknown[] = [], others: unknown[][] = [];
  let at = { x: 3, z: -4, heading: Math.PI };
  const p = joinPresence({
    token: over.token === undefined ? 'jwt-abc' : over.token, url: 'wss://example.test/origins/presence',
    open: (url, protocols) => {
      const s: Fake = { binaryType: '', readyState: 0, sent: [], closed: null, calls: { url, protocols }, send(b) { this.sent.push(b); }, close(c) { this.closed = c ?? 0; }, onopen: null, onmessage: null, onclose: null, onerror: null };
      sockets.push(s); return s;
    },
    pose: () => at, onHello: (h) => hello.push(h), onOthers: (o) => others.push(o), rng: () => 0.5,
    setTimer: (fn, ms) => { const t = { fn, ms, live: true }; timers.push(t); return t; }, clearTimer: (id) => { (id as { live: boolean }).live = false; },
    every: (fn) => { ticks.push(fn); return fn; }, clearEvery: (id) => { ticks.splice(ticks.indexOf(id as never), 1); },
  });
  const open = (s: Fake) => { s.readyState = 1; s.onopen?.(); };
  const say = (s: Fake, m: object) => s.onmessage?.({ data: JSON.stringify(m) });
  return { p, sockets, timers, ticks, hello, others, open, say, move: (x: number, z: number) => { at = { ...at, x, z }; } };
}

test('no token (signed out): nothing is opened at all', () => {
  const r = rig({ token: null });
  assert.equal(r.p, null); assert.equal(r.sockets.length, 0);
});

test('the token rides the subprotocol, never the URL', () => {
  const r = rig();
  assert.deepEqual(r.sockets[0]!.calls.protocols, [PROTOCOL, 'token.jwt-abc']);
  assert.ok(!r.sockets[0]!.calls.url.includes('jwt-abc') && !r.sockets[0]!.calls.url.includes('token'));
  assert.equal(r.sockets[0]!.binaryType, 'arraybuffer');
});

test('no pose before the hello; then 8-byte poses in presence centimetres, hero (0,0) = the Pit yard centre', () => {
  const r = rig(); const s = r.sockets[0]!; r.open(s);
  r.ticks[0]!(); assert.equal(s.sent.length, 0, 'a pose before the server placed us would look like a teleport');
  r.say(s, { t: 'hello', id: 7, layer: 2, x: CENTRE_CM, z: CENTRE_CM });
  assert.deepEqual(r.hello, [{ x: 0, z: 0, layer: 2 }]); assert.equal(r.p!.state(), 'live');
  r.ticks[0]!(); assert.equal(s.sent.length, 1); assert.equal(s.sent[0]!.length, 8);
  assert.deepEqual(decodeUp(s.sent[0]!), { x: CENTRE_CM + 300, z: CENTRE_CM - 400, heading: 128, anim: 0, flags: 0 });
  r.move(1000, -1000); r.p!.flush();
  assert.deepEqual([decodeUp(s.sent[1]!)!.x, decodeUp(s.sent[1]!)!.z], [30000, 0], 'clamped inside the 300 m square');
});

test('other players come down as metres in the same frame', () => {
  const r = rig(); const s = r.sockets[0]!; r.open(s); r.say(s, { t: 'hello', id: 1, layer: 1, x: CENTRE_CM, z: CENTRE_CM });
  const b = encodeDown(5, [{ id: 9, x: CENTRE_CM + 500, z: CENTRE_CM - 250, heading: 64, anim: 2, flags: 1, tick: 5 }]);
  s.onmessage?.({ data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) });
  const o = r.others[0]![0] as { id: number; x: number; z: number; heading: number };
  assert.equal(o.id, 9); assert.equal(o.x, 5); assert.equal(o.z, -2.5); assert.ok(Math.abs(o.heading - Math.PI / 2) < 1e-9);
});

test('headingByte wraps the compass', () => {
  assert.equal(headingByte(0), 0); assert.equal(headingByte(Math.PI), 128); assert.equal(headingByte(-Math.PI / 2), 192); assert.equal(headingByte(2 * Math.PI), 0);
});

test('a lost socket is retried after a jittered, growing wait; a welcomed one resets the count', () => {
  const r = rig(); const a = r.sockets[0]!; r.open(a); r.say(a, { t: 'hello', id: 1, layer: 1, x: CENTRE_CM, z: CENTRE_CM });
  a.onclose?.(); assert.equal(r.p!.state(), 'retrying'); assert.equal(r.timers.length, 1); assert.equal(r.timers[0]!.ms, 1000);
  r.timers[0]!.fn(); assert.equal(r.sockets.length, 2);
  r.sockets[1]!.onclose?.(); assert.equal(r.timers[1]!.ms, 1000, 'first failure: base wait');
  r.timers[1]!.fn(); r.sockets[2]!.onclose?.(); assert.equal(r.timers[2]!.ms, 2000, 'second failure: doubled');
});

test('a service that never says hello is given up on, quietly', () => {
  const r = rig();
  for (let i = 0; i < GIVE_UP_AFTER; i++) { r.sockets[i]!.onclose?.(); if (r.timers[i]) r.timers[i]!.fn(); }
  assert.equal(r.p!.state(), 'off'); assert.equal(r.sockets.length, GIVE_UP_AFTER);
});

test('stop() closes with 1000, cancels the retry and the pose timer', () => {
  const r = rig(); const s = r.sockets[0]!; r.open(s); r.p!.stop();
  assert.equal(s.closed, 1000); assert.equal(r.ticks.length, 0); assert.equal(r.p!.state(), 'off');
  s.onclose?.(); assert.equal(r.timers.length, 0, 'a stopped page never reconnects');
});

test('the URL and the kill switch', () => {
  assert.equal(presenceUrl('https://frankendom.com'), 'wss://frankendom.com/origins/presence');
  assert.equal(presenceWanted(''), true); assert.equal(presenceWanted('?presence=0'), false); assert.equal(presenceWanted('?a=1&presence=0'), false);
});
