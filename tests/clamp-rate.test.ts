// The frame clamp's rate counter (origins/preview/clamp-rate.ts): frames the 0.05 s clamp bound, and game speed = sim seconds / wall seconds. Pure.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createClampRate } from '../origins/preview/clamp-rate.ts';

const MAX = 0.05, PAUSE = 1;
const clampOf = (raw: number): number => Math.min(raw, MAX);   // what walkLoop hands the sim

test('frames inside the clamp: nothing clamped, game speed is real time', () => {
  const c = createClampRate(PAUSE);
  for (let i = 0; i < 10; i++) c.frame(0.0167, clampOf(0.0167));
  const s = c.snapshot();
  assert.equal(s.frames, 10); assert.equal(s.clamped, 0); assert.equal(s.clampedShare, 0); assert.equal(s.gameSpeed, 1);
});

test('a slow frame is clamped and the game runs slower than the wall clock', () => {
  const c = createClampRate(PAUSE);
  c.frame(0.1, clampOf(0.1)); c.frame(0.1, clampOf(0.1));   // 10 fps: half speed
  const s = c.snapshot();
  assert.equal(s.clamped, 2); assert.equal(s.clampedShare, 1); assert.equal(s.wallMs, 200); assert.equal(s.simMs, 100); assert.equal(s.gameSpeed, 0.5);
  c.frame(0.0167, clampOf(0.0167)); c.frame(0.0167, clampOf(0.0167));
  assert.equal(c.snapshot().clampedShare, 0.5);   // 2 of 4 frames
});

test('a frame exactly at the clamp is not clamped', () => {
  const c = createClampRate(PAUSE); c.frame(MAX, clampOf(MAX));
  assert.equal(c.snapshot().clamped, 0);
});

test('a pause (a hidden tab coming back) and a zero step are left out of every figure', () => {
  const c = createClampRate(PAUSE);
  c.frame(30, clampOf(30)); c.frame(0, 0); c.frame(-1, 0); c.frame(Number.NaN, 0);
  assert.deepEqual(c.snapshot(), { frames: 0, clamped: 0, paused: 1, wallMs: 0, simMs: 0, clampedShare: 0, gameSpeed: 1 });
});

test('two snapshots subtracted give a phase (the harness does this)', () => {
  const c = createClampRate(PAUSE);
  for (let i = 0; i < 5; i++) c.frame(0.1, clampOf(0.1));
  const a = c.snapshot();
  for (let i = 0; i < 4; i++) c.frame(0.0167, clampOf(0.0167));
  const b = c.snapshot();
  assert.equal(b.frames - a.frames, 4); assert.equal(b.clamped - a.clamped, 0);
});

test('the #debug mirror is written only with ?debug and only when a whole percent changes', () => {
  const off = createClampRate(PAUSE, null); off.frame(0.1, clampOf(0.1));   // nothing to write to, nothing thrown
  assert.equal(off.snapshot().frames, 1);
  const el = { dataset: {} as DOMStringMap }; let writes = 0;
  const watched = { dataset: new Proxy(el.dataset, { set: (t, k, v) => { writes++; (t as Record<string, string>)[String(k)] = v as string; return true; } }) };
  const c = createClampRate(PAUSE, watched);
  c.frame(0.1, clampOf(0.1));
  assert.equal(el.dataset.clampShare, '100'); assert.equal(el.dataset.gameSpeed, '50');
  const after = writes;
  c.frame(0.1, clampOf(0.1));   // the same percentages: no write
  assert.equal(writes, after);
});
