// PvP is not Arena 1: both peers and the verifier pin the original play circle at duel start (net/rollback.ts pvpDuel), so the same duel plays
// the same whatever circle the page's last Match left behind (play-radius.ts). A runner at the wall exercises the boundary.
import assert from 'node:assert/strict';
import test from 'node:test';
import { idleIntent, stepDuel, type Intent } from '../src/duel.ts';
import { hashDuel, pvpDuel } from '../src/net/rollback.ts';
import { ARENA_ONE_SCALE, BASE_RADIUS, RADIUS, setPlayScale } from '../src/play-radius.ts';

const play = (left: number): { hash: string; edge: number } => {
  setPlayScale(left);   // what the page's Match left behind
  let duel = pvpDuel();
  assert.equal(RADIUS, BASE_RADIUS, 'the duel pinned the original circle');
  let edge = 0;
  for (let t = 0; t < 600; t++) {
    const runner: Intent = { ...idleIntent(), move: { x: 0, z: -1, yaw: 0.4 * Math.sin(t / 40), run: true } };
    duel = stepDuel(duel, [runner, idleIntent()]);
    edge = Math.max(edge, Math.hypot(duel.fighters[0].body.x, duel.fighters[0].body.z));
  }
  return { hash: hashDuel(duel), edge };
};

test('the same PvP duel plays the same whatever circle the page left, and runs out to the original wall', () => {
  const small = play(ARENA_ONE_SCALE), full = play(1), other = play(0.6);
  assert.equal(small.hash, full.hash); assert.equal(other.hash, full.hash);
  assert.ok(full.edge > BASE_RADIUS * ARENA_ONE_SCALE + 1, `the runner reached ${full.edge.toFixed(2)} m, past the small circle`);
  setPlayScale(1);
});
