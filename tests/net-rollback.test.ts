// The rollback core over a fake link (docs/duel-architecture.md §8, days 1–2): two sessions in one process, each driven by the warden's
// AI on its own (predicted) view, their packets delayed, jittered, reordered and dropped by a seeded link. Whatever the link does, both
// sessions must confirm the same fight: the same intent log on both sides, and fingerprints equal to a plain stepDuel over that log.
import assert from 'node:assert/strict';
import test from 'node:test';
import { decide, initialAi, type AiState } from '../src/ai.ts';
import { idleIntent, stepDuel, type Duel, type Intent, type Side } from '../src/duel.ts';
import { PROFILES } from '../src/moves.ts';
import { delayFor, hashDuel, NET, playable, pvpDuel, quantile, RollbackSession, sameIntent, type NetPacket } from '../src/net/rollback.ts';
import { quantizeIntent } from '../src/record.ts';

const FRAME_MS = 1000 / 60;
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

type Link = { latencyMs: number; jitterMs: number; loss: number };
type Run = { peers: [RollbackSession, RollbackSession]; ticks: number };

// One duel of `ticks` over the link; afterwards the link turns clean and both sides keep framing (idle) until each has confirmed `ticks`.
function runLink(link: Link, ticks: number, seed = 1, initial: [Duel, Duel] = [pvpDuel(), pvpDuel()]): Run {
  const random = rng(seed);
  // The lobby's pre-duel pings over the same link (20 round trips, lost ones never return): both sides start at the delay they need.
  const pings: number[] = [];
  for (let i = 0; i < 20; i++) if (random() >= link.loss && random() >= link.loss) pings.push((2 * link.latencyMs + (random() + random()) * link.jitterMs) / FRAME_MS + 1);
  const start = delayFor(quantile(pings, 0.9));
  const peers: [RollbackSession, RollbackSession] = [new RollbackSession(0, initial[0], start), new RollbackSession(1, initial[1], start)];
  const ai: [AiState, AiState] = [initialAi(seed), initialAi(seed + 1)];
  const inFlight: { at: number; to: Side; packet: NetPacket }[] = [];
  const intentFor = (side: Side, session: RollbackSession): Intent => {
    if (session.duel.tick >= ticks) return idleIntent();
    if (session.duel.fighters[side].phase === 'sheathed') return { ...idleIntent(), action: 'light' };   // the draw: the warden waits for it
    const d = decide(session.duel, side, ai[side], PROFILES.normal); ai[side] = d.ai; return d.intent;
  };
  for (let frame = 0; frame < ticks * 4 && (peers[0].confirmed < ticks || peers[1].confirmed < ticks); frame++) {
    const now = frame * FRAME_MS;
    const clean = frame >= ticks * 2;   // a hung run is a failed run, not an endless one
    for (let i = inFlight.length - 1; i >= 0; i--) if (inFlight[i].at <= now) { peers[inFlight[i].to].receive(inFlight[i].packet); inFlight.splice(i, 1); }
    for (const side of [0, 1] as const) {
      const me = peers[side];
      me.frame(intentFor(side, me));
      if (!clean && random() < link.loss) continue;
      inFlight.push({ at: now + (clean ? 0 : link.latencyMs + random() * link.jitterMs), to: side === 0 ? 1 : 0, packet: me.outgoing() });
    }
  }
  return { peers, ticks };
}

// The same fight stepped plainly on the confirmed log: what a verifier replaying both streams computes.
function reference(log: [Intent[], Intent[]], ticks: number, initial = pvpDuel()): Map<number, string> {
  const hashes = new Map<number, string>();
  let duel = initial;
  for (let t = 1; t <= ticks; t++) { duel = stepDuel(duel, [log[0][t - 1], log[1][t - 1]]); if (t % NET.hashEvery === 0) hashes.set(t, hashDuel(duel)); }
  return hashes;
}

function assertSameFight(run: Run, label: string): void {
  const [a, b] = run.peers;
  assert.ok(a.confirmed >= run.ticks && b.confirmed >= run.ticks, `${label}: both sides confirm ${run.ticks} ticks (${a.confirmed}, ${b.confirmed})`);
  for (const side of [0, 1] as const) for (let t = 0; t < run.ticks; t++) assert.ok(sameIntent(a.log[side][t], b.log[side][t]), `${label}: side ${side}'s intent at tick ${t + 1} is the same in both logs`);
  const ref = reference(a.log, run.ticks);
  for (const [t, hash] of ref) { assert.equal(a.hashes.get(t), hash, `${label}: side 0 at tick ${t}`); assert.equal(b.hashes.get(t), hash, `${label}: side 1 at tick ${t}`); }
  assert.deepEqual([a.stats.desyncs, b.stats.desyncs], [[], []], `${label}: no desync`);
}

// Latency is one way (a round trip is twice it). Lead's ruling: PLAYABLE is held at 250 ms ROUND TRIP + 30 ms jitter + 10 % loss (the
// Dubai→Germany→Dubai relay case) and at everything better; the 550 ms round-trip link is reported and must degrade gracefully.
const LINKS: [string, Link, 'playable' | 'degrade'][] = [
  ['loopback', { latencyMs: 0, jitterMs: 0, loss: 0 }, 'playable'],
  ['same city, 80 ms RTT', { latencyMs: 40, jitterMs: 10, loss: 0 }, 'playable'],
  ['PLAYABLE bar, 250 ms RTT + 30 ms jitter + 10 % loss', { latencyMs: 125, jitterMs: 30, loss: 0.1 }, 'playable'],
  ['too slow, 550 ms RTT + 60 ms jitter + 10 % loss', { latencyMs: 275, jitterMs: 60, loss: 0.1 }, 'degrade'],
];

for (const [label, link, bar] of LINKS) {
  test(`rollback over a fake link (${label}): both sides confirm the same fight, fingerprint for fingerprint; ${bar}`, (t) => {
    const run = runLink(link, 3600, 7);
    assertSameFight(run, label);
    const [a, b] = run.peers;
    for (const s of [a, b]) assert.ok(s.stats.maxDepth <= NET.maxRollback, `${label}: no rollback deeper than ${NET.maxRollback} (${s.stats.maxDepth})`);
    if (link.latencyMs > NET.delay * FRAME_MS) assert.ok(a.stats.rollbacks + b.stats.rollbacks > 0, `${label}: a link slower than the input delay rolls back`);
    const rows = [a.metrics(), b.metrics()], show = (m: ReturnType<RollbackSession['metrics']>) => `rollbacks/min ${m.rollbacksPerMin.toFixed(0)}, depth p95 ${m.depthP95} max ${m.maxDepth}, stalls/min ${m.stallsPerMin.toFixed(1)}, delay max ${m.maxDelay}, rtt p50 ${m.rttP50Ms.toFixed(0)} p95 ${m.rttP95Ms.toFixed(0)} ms${m.tooSlow ? ', TOO SLOW' : ''}`;
    t.diagnostic(`${label}: side 0 ${show(rows[0])} | side 1 ${show(rows[1])} | finish ${JSON.stringify(a.duel.finish)}`);
    for (const [side, m] of rows.entries()) {
      if (bar === 'playable') { assert.ok(playable(m), `${label}: side ${side} is playable (${show(m)})`); assert.equal(m.tooSlow, false, `${label}: side ${side} is not flagged too slow`); }
      else { assert.equal(m.tooSlow, true, `${label}: side ${side} says "connection too slow"`); assert.ok(m.maxDelay <= NET.maxDelay, `${label}: side ${side} never lags past the cap`); }
    }
  });
}

test('rollback: a fight that differs on one side is caught as a desync within one fingerprint interval', () => {
  const tampered = pvpDuel();
  tampered.fighters[1] = { ...tampered.fighters[1], health: tampered.fighters[1].health - 1 };   // a modded client: one point of health
  const run = runLink({ latencyMs: 40, jitterMs: 10, loss: 0 }, 600, 3, [pvpDuel(), tampered]);
  const [a, b] = run.peers;
  assert.equal(a.stats.desyncs[0], NET.hashEvery, 'the honest side flags the first fingerprint');
  assert.equal(b.stats.desyncs[0], NET.hashEvery, 'and so does the modded one');
});

test('rollback: the first `delay` ticks are idle on both sides, and a peer that goes silent stalls this side at maxRollback', () => {
  const s = new RollbackSession(0, pvpDuel());
  const press = { ...idleIntent(), action: 'light' as const };
  for (let i = 0; i < 40; i++) s.frame(press);
  assert.equal(s.duel.tick, NET.delay + NET.maxRollback, 'steps through the known idle ticks, then predicts maxRollback more, then waits');
  assert.equal(s.confirmed, NET.delay);
  assert.ok(s.stats.stalls > 0);
  assert.equal(s.outgoing().from, NET.delay + 1, 'resends every unacked intent');
  assert.ok(sameIntent(s.outgoing().intents[0], quantizeIntent(press)));
});

test('rollback: a press made while this side is stalled is not lost; it rides the next scheduled tick', () => {
  const a = new RollbackSession(0, pvpDuel()), b = new RollbackSession(1, pvpDuel());
  for (let i = 0; i < 30; i++) { a.frame(idleIntent()); b.frame(idleIntent()); }   // no packets: a stalls at delay + maxRollback
  assert.ok(a.stats.stalls > 0);
  a.frame({ ...idleIntent(), action: 'light' });   // pressed during the stall
  for (let i = 0; i < 40; i++) { a.receive(b.outgoing()); b.receive(a.outgoing()); a.frame(idleIntent()); b.frame(idleIntent()); }
  assert.ok(a.log[0].some((intent) => intent.action === 'light'), 'the press reached the log');
  assert.ok(b.log[0].some((intent) => intent.action === 'light'), 'and the peer');
});

test('PvP rewards stay off until the assist-bot statistics check exists (Strategy, 2026-09-29), and src/net cannot reach a reward', async () => {
  const { PVP_REWARDS } = await import('../src/net/rewards.ts');
  assert.equal(PVP_REWARDS, false, 'turning PvP rewards on needs the statistics check in the same reviewed PR');
  const { readdirSync, readFileSync } = await import('node:fs');
  const REWARD = /from '\.\.\/(profile|career|awards|loot|loot-claims|account|cloud-profile|scorecard|ladder|match)\.ts'/;
  for (const file of readdirSync(new URL('../src/net/', import.meta.url))) {
    assert.doesNotMatch(readFileSync(new URL(`../src/net/${file}`, import.meta.url), 'utf8'), REWARD, `src/net/${file} imports a reward module`);
  }
});
