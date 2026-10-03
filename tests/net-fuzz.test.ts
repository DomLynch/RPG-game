// Hostile packets at a live duel (GPT recheck 2026-09-29 at 5f2f622; Lead: Duel writes the receive() guard in src/net, Code Quality writes
// this test). Everything a page receives came from another machine through JSON.parse: a message that is not a well-formed, in-range
// duel message is rejected — no throw, no change to the duel or the session, and the fight carries on in step with the honest peer.
import assert from 'node:assert/strict';
import test from 'node:test';
import { idleIntent, type Intent, type Side } from '../src/duel.ts';
import { PvpDuel, packIntents, type DuelMessage } from '../src/net/pvp.ts';
import { hashDuel, NET } from '../src/net/rollback.ts';
import { RECORD_VERSION } from '../src/record.ts';

const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const FRAME_MS = 1000 / 60;

// Two pages over a lossless one-frame link, with a side door into page 0 for the attacker.
function pair() {
  const inFlight: { to: Side; m: DuelMessage }[] = [];
  let now = 0;
  const sender = (from: Side) => (m: DuelMessage) => { inFlight.push({ to: from === 0 ? 1 : 0, m: JSON.parse(JSON.stringify(m)) as DuelMessage }); };
  const pages: [PvpDuel, PvpDuel] = [
    new PvpDuel(0, { weapon: 'longsword', skill: null }, sender(0), () => now),
    new PvpDuel(1, { weapon: 'estoc', skill: null }, sender(1), () => now),
  ];
  const step = (frames: number, intent: (side: Side, frame: number) => Intent = () => idleIntent()) => {
    for (let f = 0; f < frames; f++) {
      now += FRAME_MS;
      for (const { to, m } of inFlight.splice(0)) pages[to].receive(m);
      for (const side of [0, 1] as const) pages[side].frame(intent(side, f));
    }
  };
  // Deliver what is in flight TO page 0 without stepping: it then holds every intent and ack page 1 has sent, so an honest packet is old
  // news. Page 1's own mail waits for the next step, or its ack would move on and an honest packet would carry news.
  const flush = () => { for (let i = inFlight.length - 1; i >= 0; i--) if (inFlight[i].to === 0) pages[0].receive(inFlight.splice(i, 1)[0].m); };
  return { pages, step, flush };
}

// What a rejected message must leave alone: the lobby stage, the duel, what the session has confirmed and what it would send next.
const snapshot = (page: PvpDuel) => {
  const s = page.session;
  return JSON.stringify({
    stage: page.stage, refused: page.refused,
    session: s && { tick: s.duel.tick, hash: hashDuel(s.duel), confirmed: s.confirmed, delay: s.delay, out: s.outgoing(), rtt: s.rtt.length, desyncs: s.stats.desyncs.length },
  });
};

// A well-formed wire packet the attacker then bends: the honest shape of what page 1 would send next.
const honest = (page: PvpDuel) => { const p = page.session!.outgoing(); return { f: p.from, a: p.ack, h: p.hash, i: packIntents(p.intents) }; };

function hostile(peer: PvpDuel, random: () => number): unknown[] {
  const w = honest(peer), big = 'A'.repeat(1 << 20), many = packIntents(Array.from({ length: NET.redundancy * 16 }, () => idleIntent()));
  const bad = [NaN, Infinity, -Infinity, -1, 1.5, 1e12, Number.MAX_SAFE_INTEGER, '7', null, undefined, {}];
  const out: unknown[] = [
    null, undefined, 7, 'net', [], {}, { k: 'zzz' }, { k: 'net' }, { k: 'net', p: null }, { k: 'net', p: 'x' }, { k: 'net', p: [] },
    { k: 'net', p: { ...w, i: 42 } }, { k: 'net', p: { ...w, i: '!!not base64!!' } }, { k: 'net', p: { ...w, i: big } }, { k: 'net', p: { ...w, i: many } },
    { k: 'net', p: { ...w, h: 'x' } }, { k: 'net', p: { ...w, h: [NaN, 'a'] } }, { k: 'net', p: { ...w, h: [30, 7] } }, { k: 'net', p: { ...w, h: [1e12, 'a'.repeat(1 << 16)] } },
    { k: 'hello' }, { k: 'hello', v: 'x' }, { k: 'hello', v: NaN, kit: null },
    { k: 'ping', n: NaN }, { k: 'pong', n: {} }, { k: 'go', delay: NaN, kits: null },
  ];
  for (const v of bad) { out.push({ k: 'net', p: { ...w, f: v } }, { k: 'net', p: { ...w, a: v } }); }
  // Random structure: any kind, any field replaced by a random junk value.
  const junk = () => bad[Math.floor(random() * bad.length)];
  for (let n = 0; n < 200; n++) {
    const p: Record<string, unknown> = { ...w };
    for (const key of ['f', 'a', 'h', 'i']) if (random() < 0.5) p[key] = junk();
    out.push({ k: 'net', p });
  }
  return out;
}

test('a live duel rejects hostile packets: no throw, no change, and it stays in step with the honest peer', () => {
  const { pages, step, flush } = pair(), [page, peer] = pages;
  const press = (_side: Side, f: number): Intent => (f % 40 === 0 ? { ...idleIntent(), action: 'light' } : idleIntent());
  step(600, press);
  assert.equal(page.stage, 'fighting'); assert.equal(peer.stage, 'fighting');
  assert.ok(page.session!.confirmed > 300, `the duel is under way (${page.session!.confirmed} confirmed)`);
  flush();   // so every honest field in a bent packet is one page 0 already has: only the bent field could change anything
  const before = snapshot(page);
  for (const m of hostile(peer, rng(7))) {
    assert.doesNotThrow(() => page.receive(m as DuelMessage), `throws on ${JSON.stringify(m)?.slice(0, 120)}`);
    assert.equal(snapshot(page), before, `changed by ${JSON.stringify(m)?.slice(0, 120)}`);
  }
  step(600, press);
  const [x, y] = [page.session!, peer.session!];
  assert.deepEqual(x.stats.desyncs, [], 'no desync after the barrage'); assert.deepEqual(y.stats.desyncs, []);
  const upTo = Math.min(x.confirmed, y.confirmed);
  assert.ok(upTo > 900, `both kept confirming (${x.confirmed}, ${y.confirmed})`);
  assert.equal(x.hashes.get(upTo - (upTo % NET.hashEvery)), y.hashes.get(upTo - (upTo % NET.hashEvery)), 'the two pages agree on the latest confirmed fingerprint');
});

// Before the duel starts the guest takes `go` from the challenger: its delay sizes the session (one idle tick per unit of delay), so an
// out-of-range delay must not start a duel at it. Rejected, or clamped into NET's own bounds — never a session at the peer's number.
test('a guest never starts a duel at a hostile go delay', () => {
  for (const delay of [NaN, Infinity, -3, 0, 1.5, 1e6, '4', null]) {
    const page = new PvpDuel(1, { weapon: 'longsword', skill: null }, () => {}, () => 0);
    page.receive({ k: 'hello', v: RECORD_VERSION, sync: 1, kit: { weapon: 'longsword', skill: null } });
    assert.doesNotThrow(() => page.receive({ k: 'go', sync: 1, delay, kits: [{ weapon: 'longsword', skill: null }, { weapon: 'longsword', skill: null }] } as unknown as DuelMessage));
    if (page.session) {
      const d = page.session.delay;
      assert.ok(Number.isSafeInteger(d) && d >= NET.delay && d <= NET.maxDelay, `delay ${String(delay)} started a session at ${d}`);
    }
  }
});
