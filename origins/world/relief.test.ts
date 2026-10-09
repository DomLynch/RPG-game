// Zone 1 quality, step 1: relief.ts. Flat when relief is 0, within ±relief, deterministic and seeded, flat pads that blend back smoothly, gentle slopes, a 32 x 32 field that matches the samples.
import test from 'node:test';
import assert from 'node:assert/strict';
import { heightfield, reliefAt, seedOf, type Pad, type ReliefParams } from './relief.ts';
import { SCHEMA } from './schema.ts';

const P: ReliefParams = { relief: 1.5, hillScale: 40, seed: seedOf('cinder-fields') };
const grid = (fn: (x: number, z: number) => void) => { for (let x = -60; x <= 60; x += 3) for (let z = -60; z <= 60; z += 3) fn(x, z); };

test('relief 0 is flat ground, exactly', () => grid((x, z) => assert.equal(reliefAt(x, z, { ...P, relief: 0 }), 0)));

test('heights stay within ±relief for every seed tried', () => {
  for (const seed of [0, 1, 7, 12345, 2_147_483_647, seedOf('blood-ruin')]) grid((x, z) => assert.ok(Math.abs(reliefAt(x, z, { ...P, seed })) <= P.relief, `${seed} ${x},${z}`));
});

test('the same params give the same heights, another seed another landscape, and the zone id seeds it', () => {
  const a: number[] = [], b: number[] = [], c: number[] = [];
  grid((x, z) => { a.push(reliefAt(x, z, P)); b.push(reliefAt(x, z, P)); c.push(reliefAt(x, z, { ...P, seed: P.seed + 1 })); });
  assert.deepEqual(a, b);
  assert.ok(a.filter((v, i) => v !== c[i]).length > a.length * 0.9, 'a new seed changes (nearly) every height');
  assert.notEqual(seedOf('cinder-fields'), seedOf('black-mere'));
  assert.equal(seedOf('cinder-fields'), seedOf('cinder-fields'));
  assert.ok(new Set(a.map((v) => Math.round(v * 20))).size > 8, 'the hills actually vary');
});

const PINNED = [0.23639, 0.335417, -0.147245, 0.078021];
test('pinned heights: every host computes the same ground (a change here is a different landscape)', () => {
  const at = (x: number, z: number) => Math.round(reliefAt(x, z, { relief: 1.5, hillScale: 40, seed: 42 }) * 1e6) / 1e6;
  assert.deepEqual([at(0, 0), at(10, -7), at(-33.5, 21), at(55, 55)], PINNED);
});

test('a pad is flat inside its radius, blends back smoothly, and leaves the hills alone beyond 1.6 r', () => {
  const pad: Pad = { x: 5, z: -4, r: 8 };
  for (let a = 0; a < 6.3; a += 0.4) for (const d of [0, 3, 8]) assert.equal(reliefAt(pad.x + Math.cos(a) * d, pad.z + Math.sin(a) * d, P, [pad]), 0, 'flat inside r');
  for (let a = 0; a < 6.3; a += 0.4) assert.equal(reliefAt(pad.x + Math.cos(a) * 13, pad.z + Math.sin(a) * 13, P, [pad]), reliefAt(pad.x + Math.cos(a) * 13, pad.z + Math.sin(a) * 13, P), 'untouched past 1.6 r (12.8 m)');
  let worst = 0; for (let d = 8; d < 13; d += 0.05) worst = Math.max(worst, Math.abs(reliefAt(pad.x + d, pad.z, P, [pad]) - reliefAt(pad.x + d + 0.05, pad.z, P, [pad])));
  assert.ok(worst < 0.1, `the blend has no step: ${worst}`);
});

test('the hills are gentle: no slope over 0.6 (a hero walks them) at the largest relief on the shortest wavelength Zone 1 would use', () => {
  const steep = { relief: 3, hillScale: 20, seed: 9 };
  let worst = 0; grid((x, z) => { const h = reliefAt(x, z, steep); worst = Math.max(worst, Math.abs(reliefAt(x + 0.5, z, steep) - h) / 0.5, Math.abs(reliefAt(x, z + 0.5, steep) - h) / 0.5); });
  assert.ok(worst < 0.6, `steepest ${worst.toFixed(2)}`);
  let usual = 0; grid((x, z) => { const h = reliefAt(x, z, P); usual = Math.max(usual, Math.abs(reliefAt(x + 0.5, z, P) - h) / 0.5, Math.abs(reliefAt(x, z + 0.5, P) - h) / 0.5); });
  assert.ok(usual < 0.25, `the Zone 1 default (±1.5 m, 40 m) is under 0.25: ${usual.toFixed(2)}`);
});

test('heightfield is 32 x 32 row-major and equals the samples at its nodes', () => {
  const pads: Pad[] = [{ x: 0, z: 0, r: 6 }], f = heightfield(P, 62, pads), step = 62 / 31;
  assert.equal(f.length, 1024);
  for (const [i, j] of [[0, 0], [31, 0], [0, 31], [31, 31], [15, 16], [20, 5]]) assert.ok(Math.abs(f[j! * 32 + i!]! - reliefAt(-31 + i! * step, -31 + j! * step, P, pads)) < 1e-5);
});

test('the schema: relief is off by default, bounded, and part of terrain', () => {
  const t = SCHEMA.terrain.fields as unknown as Record<string, { def: number; min: number; max: number }>;
  assert.equal(t.relief!.def, 0); assert.equal(t.relief!.max, 3); assert.equal(t.hillScale!.def, 40); assert.equal(t.seed!.def, 0);
});
