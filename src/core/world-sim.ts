// The world sim's pure creature behaviour: the seeded random, a creature's notice (aggro with hysteresis), wander and facing, and who is drawn. Moved out of
// origins/preview/mobs.ts (core slice 3, Combat + Backend) with no change to a number or a branch; mobs.ts imports and re-exports it, so every caller and test is
// unchanged. Pure: no three.js, no DOM, no clock, no origins/ import. Server-run code reaches it through src/core/server.ts.
import { SPEEDS } from '../fight/server.ts';

export type Pos = { x: number; z: number };
export type MobMode = 'idle' | 'wander' | 'aggro';
export type Mob = { x: number; z: number; facing: number; mode: MobMode; wait: number; tx: number; tz: number; rng: number };

/** What the stepper reads of a creature's spec: its home, how far it roams and how far it notices. origins' MobSpec has these and more. */
export type Roamer = { home: Pos; roam: number; aggro: number };

export const TUNING = {
  walk: SPEEDS.creature.amble,   // m/s: a creature's amble, well under the hero's walk (the one speed table, speeds.ts)
  turn: 3.2,            // rad/s the body swings toward where it is going or looking
  aggro: 7,             // m: the ring a creature notices the hero inside (named ones 9)
  aggroNamed: 9,
  hold: 1.5,            // m: it keeps looking until the hero is this much beyond the ring (no flicker on the rim)
  idle: [1.5, 4.5] as const,   // s: how long it stands between amblings
  arrive: 0.35,         // m: close enough to the spot
  clear: 0.7,           // m: how far from a solid a creature keeps
  edge: 2,              // m: and from its zone's edge
  cap: 12,              // creatures drawn at once
  range: 45,            // m: none are drawn beyond this
  seed: 0x0f1e2d3c,
};

// ---- the seeded random: mulberry32, state in, [0..1) and the next state out ---------------------------------------------------

export function nextRandom(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}
export const mixSeed = (seed: number, n: number) => (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(n + 1, 0xc2b2ae35)) >>> 0;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function newMob(spec: Roamer, index: number): Mob {
  const [a, r1] = nextRandom(mixSeed(TUNING.seed, 1000 + index)), [w, rng] = nextRandom(r1);
  return { x: spec.home.x, z: spec.home.z, facing: a * Math.PI * 2 - Math.PI, mode: 'idle', wait: TUNING.idle[0] + w * (TUNING.idle[1] - TUNING.idle[0]), tx: spec.home.x, tz: spec.home.z, rng };
}

// The aggro test, with hysteresis: it notices the hero inside `aggro`, and keeps watching until the hero is `hold` beyond it.
export const aggroTest = (m: Mob, s: Pick<Roamer, 'aggro'>, hero: Pos | null): boolean => {
  if (!hero) return false;
  const d = Math.hypot(hero.x - m.x, hero.z - m.z);
  return m.mode === 'aggro' ? d <= s.aggro + TUNING.hold : d < s.aggro;
};
// Swing a heading toward a target by at most `step` radians, the short way round.
export const turnToward = (facing: number, target: number, step: number): number => {
  const d = wrap(target - facing);
  return Math.abs(d) <= step ? wrap(target) : wrap(facing + Math.sign(d) * step);
};
export const headingTo = (from: Pos, to: Pos): number => Math.atan2(to.x - from.x, to.z - from.z);

// One wander target: a seeded point within `roam` of home that the creature may stand on, or null (it stays put a while longer).
export function wanderTarget(s: Roamer, rng: number, stand: (x: number, z: number) => boolean): { to: Pos | null; rng: number } {
  let u: number, v: number;
  [u, rng] = nextRandom(rng); [v, rng] = nextRandom(rng);
  const r = s.roam * Math.sqrt(u), a = v * Math.PI * 2, x = s.home.x + Math.sin(a) * r, z = s.home.z + Math.cos(a) * r;
  return { to: stand(x, z) ? { x, z } : null, rng };
}

export function stepMob(m: Mob, s: Roamer, hero: Pos | null, dt: number, stand: (x: number, z: number) => boolean): Mob {
  if (aggroTest(m, s, hero)) return { ...m, mode: 'aggro', facing: turnToward(m.facing, headingTo(m, hero!), TUNING.turn * 2 * dt) };
  if (m.mode === 'aggro') m = { ...m, mode: 'idle', wait: 1.2 };   // the hero left: a breath, then back to its round
  if (m.mode === 'idle') {
    const wait = m.wait - dt;
    if (wait > 0) return { ...m, wait };
    const [w, r1] = nextRandom(m.rng), t = wanderTarget(s, r1, stand), pause = TUNING.idle[0] + w * (TUNING.idle[1] - TUNING.idle[0]);
    return t.to ? { ...m, mode: 'wander', tx: t.to.x, tz: t.to.z, wait: pause, rng: t.rng } : { ...m, wait: pause, rng: t.rng };
  }
  // wander: swing toward the spot, then amble; stop at the spot, or the moment the next step would leave the walkable ground
  const want = headingTo(m, { x: m.tx, z: m.tz }), facing = turnToward(m.facing, want, TUNING.turn * dt);
  if (Math.hypot(m.tx - m.x, m.tz - m.z) < TUNING.arrive) return { ...m, facing, mode: 'idle' };
  if (Math.abs(wrap(want - facing)) > 0.6) return { ...m, facing };
  const nx = m.x + Math.sin(facing) * TUNING.walk * dt, nz = m.z + Math.cos(facing) * TUNING.walk * dt;
  return stand(nx, nz) ? { ...m, x: nx, z: nz, facing } : { ...m, facing, mode: 'idle' };
}

// Who is drawn: the nearest `cap` creatures within `range` of the hero, nearest first (indexes into `at`).
export function pickVisible(at: readonly Pos[], hero: Pos, cap = TUNING.cap, range = TUNING.range): number[] {
  return at.map((p, i) => ({ i, d: Math.hypot(p.x - hero.x, p.z - hero.z) })).filter((e) => e.d <= range).sort((a, b) => a.d - b.d || a.i - b.i).slice(0, cap).map((e) => e.i);
}

