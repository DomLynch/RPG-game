// The rollback core over a fake link (docs/duel-architecture.md §8, days 1–2): two sessions in one process, each driven by the warden's
// AI on its own (predicted) view, their packets delayed, jittered, reordered and dropped by a seeded link. Whatever the link does, both
// sessions must confirm the same fight: the same intent log on both sides, and fingerprints equal to a plain stepDuel over that log.
import assert from 'node:assert/strict';
import test from 'node:test';
import { decide, initialAi, type AiState } from '../src/ai.ts';
import { idleIntent, stepDuel, type Duel, type Intent, type Side } from '../src/duel.ts';
import { PROFILES } from '../src/moves.ts';
import { hashDuel, NET, pvpDuel, RollbackSession, sameIntent, type NetPacket } from '../src/net/rollback.ts';
import { quantizeIntent } from '../src/record.ts';

const FRAME_MS = 1000 / 60;
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

type Link = { latencyMs: number; jitterMs: number; loss: number };
type Run = { peers: [RollbackSession, RollbackSession]; ticks: number };

// One duel of `ticks` over the link; afterwards the link turns clean and both sides keep framing (idle) until each has confirmed `ticks`.
function runLink(link: Link, ticks: number, seed = 1, initial: [Duel, Duel] = [pvpDuel(), pvpDuel()]): Run {
  const random = rng(seed), peers: [RollbackSession, RollbackSession] = [new RollbackSession(0, initial[0]), new RollbackSession(1, initial[1])];
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

const LINKS: [string, Link][] = [
  ['loopback', { latencyMs: 0, jitterMs: 0, loss: 0 }],
  ['same city, 40 ms', { latencyMs: 40, jitterMs: 10, loss: 0 }],
  ['Dubai–SEA, 120 ms + 5 % loss', { latencyMs: 120, jitterMs: 30, loss: 0.05 }],
  ['Poor, 250 ms + 10 % loss', { latencyMs: 250, jitterMs: 60, loss: 0.1 }],
];

for (const [label, link] of LINKS) {
  test(`rollback over a fake link (${label}): both sides confirm the same fight, fingerprint for fingerprint`, (t) => {
    const run = runLink(link, 3600, 7);
    assertSameFight(run, label);
    const [a, b] = run.peers;
    for (const s of [a, b]) assert.ok(s.stats.maxDepth <= NET.maxRollback, `${label}: no rollback deeper than ${NET.maxRollback} (${s.stats.maxDepth})`);
    if (link.latencyMs > NET.delay * FRAME_MS) assert.ok(a.stats.rollbacks + b.stats.rollbacks > 0, `${label}: a link slower than the input delay rolls back`);
    const minutes = run.ticks / 3600;
    t.diagnostic(`${label}: rollbacks/min ${(a.stats.rollbacks / minutes).toFixed(0)} / ${(b.stats.rollbacks / minutes).toFixed(0)}, max depth ${a.stats.maxDepth} / ${b.stats.maxDepth}, stalls ${a.stats.stalls} / ${b.stats.stalls}, finish ${JSON.stringify(a.duel.finish)}`);
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
