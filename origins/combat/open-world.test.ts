// The open world runs the Pit's own sim (src/duel.ts, ai.ts, sim.ts): the one departure is the wall. A duel carries its own (Duel.radius, RV40); the open world's is OPEN_RADIUS, the Pit's duels carry none and
// read the live circle, so a Pit fight is byte for byte what it was. Replaces the copy-parity tests of the deleted duel-open / ai-open / sim-open.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFighter, idleIntent, initialDuel, opponentFighter, stepDuel, walled, type Duel } from '../../src/duel.ts';
import { decide, initialAi } from '../../src/ai.ts';
import { OPPONENTS, profileAt } from '../../src/moves.ts';
import { BASE_RADIUS, OPEN_RADIUS, PLAY_SCALE, setPlayScale } from '../../src/play-radius.ts';
import { RADIUS } from '../../src/sim.ts';
import { creature, newWorld, player, stepCombat } from './zone1.ts';

const body = (x: number, z: number, heading: number) => ({ x, z, heading, distance: 0 });
const fight = (x: number, z: number, radius?: number): Duel => ({ tick: 0, fighters: [createFighter(body(x, z, Math.PI), 'ready'), opponentFighter(OPPONENTS.wolf, body(x, z - 3, 0))], finish: null, events: [], ...(radius !== undefined ? { radius } : {}) });
const run = (d: Duel, ticks: number): Duel => {
  let ai = initialAi(1); const profile = profileAt(OPPONENTS.wolf, 18);
  for (let t = 0; t < ticks; t++) { const r = decide(d, 1, ai, profile); ai = r.ai; d = stepDuel(d, [{ ...idleIntent(), move: { x: 0, z: 1, yaw: 0, run: true } }, r.intent]); }
  return d;
};

test('no wall: a fight 100 m from the Pit marks runs and nobody is pulled back to a ring', () => {
  const d = run(fight(100, 100, OPEN_RADIUS), 600);
  for (const f of d.fighters) assert.ok(Math.hypot(f.body.x, f.body.z) > 90, `pulled to ${f.body.x},${f.body.z}`);
  assert.ok(walled(d.fighters[0].body, 1, 0, d.radius) === false, 'walled() is dead in the open');
  assert.equal(d.radius, OPEN_RADIUS, 'the duel keeps its wall through every step');
});

test('a duel with no radius is the Pit\'s: the live circle clamps it, and the live circle is not touched by an open duel', () => {
  const before = RADIUS, scale = PLAY_SCALE;
  assert.equal(before, BASE_RADIUS, 'a fresh page has the Pit\'s 8.55 m circle');
  const pit = run(fight(100, 100), 120);
  assert.ok(Math.hypot(pit.fighters[0].body.x, pit.fighters[0].body.z) < 30, 'the Pit wall clamps a duel without a radius');
  assert.equal('radius' in pit, false, 'and a Pit duel never gains the field (its JSON is byte for byte what it was)');
  run(fight(100, 100, OPEN_RADIUS), 120);
  assert.equal(RADIUS, before); assert.equal(PLAY_SCALE, scale);
  setPlayScale(0.36); const small = RADIUS; run(fight(5, 5, OPEN_RADIUS), 60); assert.equal(RADIUS, small, 'a scaled arena\'s circle is untouched'); setPlayScale(scale);
});

test('the Pit\'s sim is byte-identical after open-world steps: same duel, same bytes', () => {
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
  assert.equal(pitRun(), first, 'the Pit duel plays byte for byte the same after the open world has run');
});
