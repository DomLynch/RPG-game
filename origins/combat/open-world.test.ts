// The open world runs the Pit's own sim (src/duel.ts, ai.ts, sim.ts): the one departure is the missing ring wall, play-radius.ts underOpenWorld. Replaces the copy-parity tests of the deleted duel-open / ai-open / sim-open.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFighter, idleIntent, opponentFighter, stepDuel, walled, type Duel } from '../../src/duel.ts';
import { decide, initialAi } from '../../src/ai.ts';
import { OPPONENTS, profileAt } from '../../src/moves.ts';
import { BASE_RADIUS, OPEN_RADIUS, underOpenWorld } from '../../src/play-radius.ts';
import { RADIUS } from '../../src/sim.ts';

const body = (x: number, z: number, heading: number) => ({ x, z, heading, distance: 0 });
const fight = (x: number, z: number): Duel => ({ tick: 0, fighters: [createFighter(body(x, z, Math.PI), 'ready'), opponentFighter(OPPONENTS.wolf, body(x, z - 3, 0))], finish: null, events: [] });
const run = (d: Duel, ticks: number): Duel => {
  let ai = initialAi(1); const profile = profileAt(OPPONENTS.wolf, 18);
  for (let t = 0; t < ticks; t++) { const r = decide(d, 1, ai, profile); ai = r.ai; d = stepDuel(d, [{ ...idleIntent(), move: { x: 0, z: 1, yaw: 0, run: true } }, r.intent]); }
  return d;
};

test('no wall: a fight 100 m from the Pit marks runs and nobody is pulled back to a ring', () => {
  const d = underOpenWorld(() => run(fight(100, 100), 600));
  for (const f of d.fighters) assert.ok(Math.hypot(f.body.x, f.body.z) > 90, `pulled to ${f.body.x},${f.body.z}`);
  assert.ok(underOpenWorld(() => walled(d.fighters[0].body, 1, 0)) === false, 'walled() is dead in the open');
});

test('underOpenWorld puts the Pit\'s circle back, even when the step throws, and outside it the Pit\'s wall still clamps', () => {
  const before = RADIUS;
  assert.equal(underOpenWorld(() => RADIUS), OPEN_RADIUS);
  assert.throws(() => underOpenWorld(() => { throw new Error('x'); }), /x/);
  assert.equal(RADIUS, before, 'restored after both');
  assert.equal(before, BASE_RADIUS, 'a fresh page has the Pit\'s 8.55 m circle');
  const d = run(fight(100, 100), 120);   // the Pit's own rules: a fighter placed far outside is pulled to the wall
  assert.ok(Math.hypot(d.fighters[0].body.x, d.fighters[0].body.z) < 30, 'the Pit wall clamps outside the open world');
});
