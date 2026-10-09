// The open world runs the Pit's own sim (src/duel.ts, ai.ts, sim.ts): the one departure is the missing ring wall, play-radius.ts underOpenWorld. Replaces the copy-parity tests of the deleted duel-open / ai-open / sim-open.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFighter, idleIntent, initialDuel, opponentFighter, stepDuel, walled, type Duel } from '../../src/duel.ts';
import { creature, newWorld, player, stepCombat, type Input } from './zone1.ts';
import { decide, initialAi } from '../../src/ai.ts';
import { OPPONENTS, profileAt } from '../../src/moves.ts';
import { BASE_RADIUS, PLAY_SCALE, setPlayScale } from '../../src/play-radius.ts';
import { OPEN_RADIUS, underOpenWorld } from './open-world.ts';
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
  const before = RADIUS, scale = PLAY_SCALE;
  assert.equal(underOpenWorld(() => RADIUS), OPEN_RADIUS);
  assert.throws(() => underOpenWorld(() => { throw new Error('x'); }), /x/);
  assert.equal(RADIUS, before, 'restored after both'); assert.equal(PLAY_SCALE, scale);
  setPlayScale(0.36); const small = RADIUS; underOpenWorld(() => 0); assert.equal(RADIUS, small, 'a scaled arena\'s circle comes back exactly'); setPlayScale(scale);
  assert.equal(before, BASE_RADIUS, 'a fresh page has the Pit\'s 8.55 m circle');
  const d = run(fight(100, 100), 120);   // the Pit's own rules: a fighter placed far outside is pulled to the wall
  assert.ok(Math.hypot(d.fighters[0].body.x, d.fighters[0].body.z) < 30, 'the Pit wall clamps outside the open world');
});

test('a step that throws midway still restores the Pit\'s circle (the real stepCombat, an input that throws as the bout reads it)', () => {
  const before = RADIUS, scale = PLAY_SCALE, boom = { get x(): number { throw new Error('boom'); }, z: 0 } as unknown as Input;
  const w = newWorld([player('p', 0, 0), creature('c', 'wolf', 0, 2)]);
  for (let i = 0; i < 90; i++) stepCombat(w, { p: { x: 0, z: 0 } }, 1 / 60);   // engaged, so a bout is stepping
  assert.throws(() => { let cur = w; for (let i = 0; i < 90; i++) cur = stepCombat(cur, { p: i === 45 ? boom : { x: 0, z: 0 } }, 1 / 60).world; }, /boom/);
  assert.equal(RADIUS, before); assert.equal(PLAY_SCALE, scale);
});

test('the Pit\'s sim is byte-identical after open-world steps (and after a throwing one): same duel, same bytes', () => {
  const pitRun = (): string => {
    const o = OPPONENTS.veteran, profile = profileAt(o, 18); let d = initialDuel(o, 'longsword'), ai = initialAi(731);
    for (let t = 0; t < 900; t++) {
      const r = decide(d, 1, ai, profile); ai = r.ai;
      d = stepDuel(d, [t % 97 === 5 ? { ...idleIntent(), action: 'light' } : t % 131 === 40 ? { ...idleIntent(), action: 'heavy' } : { ...idleIntent(), move: { x: 0, z: t % 53 < 20 ? 1 : 0, yaw: 0, run: false } }, r.intent]);
    }
    return JSON.stringify(d);
  };
  const first = pitRun();
  let w = newWorld([player('p', 0, 0), creature('c', 'boar', 0, 2)]);
  for (let i = 0; i < 300; i++) w = stepCombat(w, { p: { x: 0, z: 0, attack: i % 40 === 0 ? 'light' : null } }, 1 / 60).world;   // an open-world fight in between
  try { stepCombat(w, { p: { get x(): number { throw new Error('x'); }, z: 0 } as unknown as Input }, 1 / 60); } catch { /* the throwing step */ }
  assert.equal(pitRun(), first, 'the Pit duel plays byte for byte the same after the open world has run');
});
