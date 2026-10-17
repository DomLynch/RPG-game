// Calmer drawn movement (mob-calm.ts): a creature that flips its circling side every 0.8 s is drawn sweeping much more slowly, a lunge stays snappy, the body turns at a capped rate, a teleport snaps.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fxNum } from '../../src/fight/fx-rows.ts';
import { calmStep, type Calm } from './mob-calm.ts';

const ROWS = { lateralTau: fxNum('mob-view.lateral-tau'), radialTau: fxNum('mob-view.radial-tau'), turnDps: fxNum('mob-view.turn-dps'), snapM: fxNum('mob-view.snap-m'), maxOrbitDps: fxNum('mob-view.max-orbit-dps'), maxLagM: fxNum('mob-view.max-lag-m') }, HERO = { x: 0, z: 0 }, DT = 1 / 60;
const deg = (a: number) => a * 180 / Math.PI;
const sweep = (a: Calm, b: Calm) => { let d = Math.atan2(b.x, b.z) - Math.atan2(a.x, a.z); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(deg(d)) / DT; };

test('a creature flipping its circling side every 0.8 s is drawn at no more than the sweep cap around the hero', () => {
  let sim: Calm = { x: 0, z: 1.2, facing: Math.PI }, drawn = sim, side = 1, maxLag = 0; let maxSim = 0, maxDrawn = 0, sumSim = 0, sumDrawn = 0, n = 0;
  for (let t = 0; t < 12; t += DT) {
    if (Math.floor(t / 0.8) !== Math.floor((t - DT) / 0.8)) side = -side;   // the engine's decision flips the side
    const a = Math.atan2(sim.x, sim.z) + side * (60 * Math.PI / 180) * DT, next: Calm = { x: Math.sin(a) * 1.2, z: Math.cos(a) * 1.2, facing: a + Math.PI };
    const nd = calmStep(drawn, next, HERO, DT, ROWS); const s1 = sweep(sim, next), s2 = sweep(drawn, nd); maxSim = Math.max(maxSim, s1); maxDrawn = Math.max(maxDrawn, s2); sumSim += s1; sumDrawn += s2; n++; maxLag = Math.max(maxLag, Math.hypot(next.x - nd.x, next.z - nd.z)); sim = next; drawn = nd;
  }
  assert.ok(maxLag <= ROWS.maxLagM + 1e-6, `never more than ${ROWS.maxLagM} m behind the engine (${maxLag.toFixed(2)})`); assert.ok(maxDrawn <= maxSim + 1, `peak sweep ${maxDrawn.toFixed(0)} deg/s vs the engine's ${maxSim.toFixed(0)}: never faster than the engine (the 0.3 m lag bound keeps the drawn body on the hit)`); assert.ok(sumDrawn / n < sumSim / n * 0.95, `mean sweep ${(sumDrawn / n).toFixed(0)} vs ${(sumSim / n).toFixed(0)} deg/s`);
});

test('a lunge toward the hero stays snappy (90% of a 1.5 m closing in 0.2 s)', () => {
  let drawn: Calm = { x: 0, z: 3, facing: Math.PI }; const goal: Calm = { x: 0, z: 1.5, facing: Math.PI };
  for (let t = 0; t < 0.2; t += DT) drawn = calmStep(drawn, goal, HERO, DT, ROWS);
  assert.ok(drawn.z < 1.65, `closed to ${drawn.z.toFixed(2)} m`);
});

test('the body turns no faster than turnDps, and a teleport (more than snapM) snaps', () => {
  let drawn: Calm = { x: 0, z: 2, facing: 0 }; const goal: Calm = { x: 0, z: 2, facing: Math.PI };
  const next = calmStep(drawn, goal, HERO, DT, ROWS); assert.ok(deg(next.facing - drawn.facing) <= ROWS.turnDps * DT + 1e-6, 'one frame of turning is capped');
  drawn = calmStep({ x: 0, z: 2, facing: 0 }, { x: 10, z: 2, facing: 1 }, HERO, DT, ROWS); assert.deepEqual(drawn, { x: 10, z: 2, facing: 1 });
});
