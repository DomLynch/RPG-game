// The forced-rollback sync test (Dom's GO via Lead, 2026-10-07): the entry ticket for every sim change. Live PvP rolls back and re-steps
// on late peer intents, so a sim step must give the same state whether it ran once or was rolled back and re-run. Two halves:
//  (1) pure re-sim: over recorded PvP inputs, from EVERY tick, roll back 1..NET.maxRollback ticks, re-step on the same inputs, and the
//      state after every re-stepped tick must equal the straight run's, byte for byte (full JSON, events included), the snapshot
//      untouched by it;
//  (2) the real RollbackSession under links that force rollbacks of every depth (peer intents arrive 3..10 frames late and are
//      mispredicted): at every frame the confirmed state's fingerprint must equal a plain replay of the finally agreed log at that tick,
//      both sides agree, no desync is flagged, and the run really did roll back (a quiet link would prove nothing).
// Any sim change that breaks re-sim determinism (state that survives a step, a clock, an unrestored field) fails here, not in a live duel.
import assert from 'node:assert/strict';
import test from 'node:test';
import { decide, initialAi, type AiState } from '../src/ai.ts';
import { idleIntent, stepDuel, type Duel, type Intent, type Side } from '../src/duel.ts';
import { PROFILES, PLAYER_WEAPONS } from '../src/moves.ts';
import { hashDuel, NET, pvpDuel, RollbackSession, sameIntent, type NetPacket } from '../src/net/rollback.ts';
import { quantizeIntent } from '../src/record.ts';

const kit = (fight: number) => {
  const w = PLAYER_WEAPONS;
  return [{ weapon: w[fight % w.length], skill: fight % 3 === 0 ? ('pommel' as const) : null }, { weapon: w[Math.floor(fight / w.length) % w.length], skill: null }] as const;
};

// One recorded duel: the warden's AI on both sides, intents on the wire's bits (the fixture's recipe), every state kept.
function record(fight: number, ticks: number) {
  const [a, b] = kit(fight);
  const initial = pvpDuel(a, b);
  const ai: [AiState, AiState] = [initialAi(fight * 2 + 1), initialAi(fight * 2 + 2)];
  const inputs: [Intent[], Intent[]] = [[], []], states: Duel[] = [initial];
  let duel = initial;
  for (let t = 1; t <= ticks; t++) {
    const pair = ([0, 1] as const).map((side) => {
      if (duel.fighters[side].phase === 'sheathed') return { ...idleIntent(), action: 'light' as const };
      const d = decide(duel, side, ai[side], PROFILES.normal); ai[side] = d.ai; return quantizeIntent(d.intent);
    }) as [Intent, Intent];
    inputs[0].push(pair[0]); inputs[1].push(pair[1]);
    duel = stepDuel(duel, pair); states.push(duel);
  }
  return { initial, inputs, states };
}
const full = (duel: Duel): string => JSON.stringify(duel);

test('synctest: from every tick, a rollback of 1..maxRollback ticks re-steps to the byte-identical states, snapshots untouched', () => {
  let resteps = 0;
  for (const fight of [0, 1, 7, 12, 20]) {
    const ticks = 420, { inputs, states } = record(fight, ticks);
    const text = states.map(full);   // the straight run, serialised once
    for (let t = 1; t <= ticks; t++) {
      for (let depth = 1; depth <= Math.min(t, NET.maxRollback); depth++) {
        const start = states[t - depth], before = text[t - depth];
        let duel = start;
        for (let k = t - depth + 1; k <= t; k++) {
          duel = stepDuel(duel, [inputs[0][k - 1], inputs[1][k - 1]]);
          assert.equal(full(duel), text[k], `fight ${fight}: re-step to tick ${k} after a rollback of ${depth} from tick ${t} differs from the straight run`);
          resteps++;
        }
        assert.equal(full(start), before, `fight ${fight}: the snapshot at tick ${t - depth} was changed by re-stepping from it`);
      }
    }
  }
  assert.ok(resteps > 50_000, `the sweep really ran (${resteps} re-stepped ticks)`);
});

// Packets cross a link of a fixed number of frames each way with no loss: the peer's real intents always land `lag` frames late, so the
// session predicts `lag - delay` ticks ahead and every changed intent forces a rollback of about that depth.
function forcedRun(fight: number, ticks: number, lag: number) {
  const [a, b] = kit(fight);
  const delay = NET.delay;
  const peers: [RollbackSession, RollbackSession] = [new RollbackSession(0, pvpDuel(a, b), delay), new RollbackSession(1, pvpDuel(a, b), delay)];
  const ai: [AiState, AiState] = [initialAi(fight * 2 + 1), initialAi(fight * 2 + 2)];
  const inFlight: { at: number; to: Side; packet: NetPacket }[] = [];
  const seen: [number, string][][] = [[], []];   // per frame: the confirmed tick and its fingerprint, checked against the agreed log afterwards
  const intentFor = (side: Side, s: RollbackSession): Intent => {
    if (s.duel.tick >= ticks) return idleIntent();
    if (s.duel.fighters[side].phase === 'sheathed') return { ...idleIntent(), action: 'light' };
    const d = decide(s.duel, side, ai[side], PROFILES.normal); ai[side] = d.ai; return d.intent;
  };
  for (let frame = 0; frame < ticks * 4 && (peers[0].confirmed < ticks || peers[1].confirmed < ticks); frame++) {
    for (let i = inFlight.length - 1; i >= 0; i--) if (inFlight[i].at <= frame) { peers[inFlight[i].to].receive(inFlight[i].packet); inFlight.splice(i, 1); }
    for (const side of [0, 1] as const) {
      const me = peers[side];
      me.frame(intentFor(side, me));
      inFlight.push({ at: frame + lag, to: side === 0 ? 1 : 0, packet: me.outgoing() });
      seen[side].push([me.confirmed, hashDuel(me.confirmedDuel())]);
    }
  }
  return { peers, ticks, seen, pristine: [a, b] as const };
}

for (const [fight, lag] of [[0, 3], [1, 5], [7, 7], [12, 9], [20, 10], [3, 6]] as const) {
  test(`synctest: forced rollbacks, peer intents ${lag} frames late (fight ${fight}): every confirmed tick equals the plain replay, both sides agree`, () => {
    const run = forcedRun(fight, 600, lag), [x, y] = run.peers;
    assert.ok(x.confirmed >= run.ticks && y.confirmed >= run.ticks, `both sides confirm ${run.ticks} ticks (${x.confirmed}, ${y.confirmed})`);
    for (const side of [0, 1] as const) for (let t = 0; t < run.ticks; t++) assert.ok(sameIntent(x.log[side][t], y.log[side][t]), `side ${side}'s intent at tick ${t + 1} is the same in both logs`);
    // The plain replay of the agreed log, tick by tick.
    const ref: string[] = [hashDuel(pvpDuel(...kit(fight)))];
    let duel = pvpDuel(...kit(fight));
    for (let t = 1; t <= run.ticks; t++) { duel = stepDuel(duel, [x.log[0][t - 1], x.log[1][t - 1]]); ref.push(hashDuel(duel)); }
    for (const side of [0, 1] as const) run.seen[side].forEach(([tick, hash], frame) => assert.equal(hash, ref[tick], `side ${side}, frame ${frame}: the confirmed state at tick ${tick} differs from the plain replay`));
    assert.deepEqual([x.stats.desyncs, y.stats.desyncs], [[], []], 'no desync flagged');
    // Not vacuous: the link really forced rollbacks, deep ones.
    for (const s of run.peers) { assert.ok(s.stats.rollbacks >= 20, `rollbacks happened (${s.stats.rollbacks})`); assert.ok(s.stats.resimTicks >= s.stats.rollbacks, `ticks were re-simulated (${s.stats.resimTicks})`); }
    assert.ok(Math.max(x.stats.maxDepth, y.stats.maxDepth) >= Math.min(lag - NET.delay, NET.maxRollback) - 1, `depth reached the link's lookahead (${x.stats.maxDepth}, ${y.stats.maxDepth})`);
  });
}
