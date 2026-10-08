// The open-world COPIES of the Pit's duel and brain (duel-open.ts, ai-open.ts, sim-open.ts): the copy must be the Pit step bit for bit wherever the wall does not bite, and must have no wall.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as pit from '../../src/duel.ts';
import * as open from './duel-open.ts';
import { decide as pitDecide, initialAi as pitAi } from '../../src/ai.ts';
import { decide as openDecide, initialAi as openAi } from './ai-open.ts';
import { OPPONENTS, RULES, profileAt } from '../../src/moves.ts';
import { RADIUS as PIT_RADIUS } from '../../src/sim.ts';

const LEVELS = [1, 6, 18, 46] as const;
const press = (t: number, k: number): pit.Intent => {   // a scripted player: the same on both sides
  const base = pit.idleIntent();
  if (t % 97 === 5 + k) return { ...base, action: 'light' };
  if (t % 131 === 40 + k) return { ...base, action: 'heavy' };
  if (t % 173 === 60) return { ...base, action: 'dodge', move: { x: 1, z: 0, yaw: 0, run: false } };
  if (t % 211 > 150) return { ...base, guard: true };
  return { ...base, move: { x: 0, z: t % 53 < 20 ? 1 : 0, yaw: 0, run: false } };
};

for (const id of ['goblin', 'veteran', 'wolf', 'boar', 'bear'] as const) for (const level of LEVELS) test(`copy parity: ${id} L${level} - the open duel equals the Pit's duel, tick for tick, away from the wall`, () => {
  const o = OPPONENTS[id], profile = profileAt(o, level);
  let a = pit.initialDuel(o, 'longsword'), b = open.initialDuel(o, 'longsword');
  let aiA = pitAi(731), aiB = openAi(731), compared = 0;
  for (let t = 0; t < 1200; t++) {
    const hero = pit.idleIntent(); void hero;
    const ra = pitDecide(a, 1, aiA, profile), rb = openDecide(b as never, 1, aiB, profile);
    aiA = ra.ai; aiB = rb.ai;
    a = pit.stepDuel(a, [press(t, 0), ra.intent]);
    b = open.stepDuel(b, [press(t, 0), rb.intent]) as never;
    const band = (d: typeof a) => d.fighters.every((f) => Math.hypot(f.body.x, f.body.z) < PIT_RADIUS - RULES.wall.edge - 1.5);   // the wall (RADIUS, the edge band, the loiter band, the knockback clamp) never bit
    if (!band(a)) break;
    assert.equal(JSON.stringify(b), JSON.stringify(a), `${id} L${level} diverged at tick ${t}`);
    compared++;
  }
  assert.ok(compared >= 120, `only ${compared} ticks compared before a fighter neared the wall`);
});

test('no wall: a fight 100 m from the Pit marks runs and nobody is pulled back to a ring', () => {
  const body = (x: number, z: number, heading: number) => ({ x, z, heading, distance: 0 });
  let d: open.Duel = { tick: 0, fighters: [open.createFighter(body(100, 100, Math.PI), 'ready'), open.opponentFighter(OPPONENTS.wolf, body(100, 97, 0))], finish: null, events: [] };
  let ai = openAi(1); const profile = profileAt(OPPONENTS.wolf, 18);
  for (let t = 0; t < 600; t++) { const r = openDecide(d, 1, ai, profile); ai = r.ai; d = open.stepDuel(d, [{ ...open.idleIntent(), move: { x: 0, z: 1, yaw: 0, run: true } }, r.intent]); }
  for (const f of d.fighters) assert.ok(Math.hypot(f.body.x, f.body.z) > 90, `pulled to ${f.body.x},${f.body.z}`);
  assert.ok(open.walled(d.fighters[0].body, 1, 0) === false, 'walled() is dead in the open');
});
