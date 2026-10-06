import test from 'node:test';
import assert from 'node:assert/strict';
import { warmFirstFrame } from '../src/first-frame.ts';

const base = () => { const log: string[] = []; return { log, w: { textures: ['a', 'b', 'c'], upload: (t: unknown) => { log.push('up:' + String(t)); }, draw: () => { log.push('draw'); }, frame: () => Promise.resolve(), budgetMs: 1000, sliceMs: 5, now: () => 0, lost: () => false } }; };

test('the first-frame warm-up uploads each map once, a frame\'s slice at a time, then draws once', async () => {
  const { log, w } = base(); let frames = 0, clock = 0; const sliced = { ...w, frame: () => { frames++; return Promise.resolve(); }, now: () => clock, upload: (t: unknown) => { log.push('up:' + String(t)); clock += 3; } };
  assert.equal(await warmFirstFrame(sliced), 'done');
  assert.deepEqual(log, ['up:a', 'up:b', 'up:c', 'draw']);
  assert.equal(frames, 3, 'a 5 ms slice fits two 3 ms uploads: a frame for a+b, a frame for c, a frame before the draw');
});

test('a slow device does not hold the card: past the budget the warm-up stops touching the renderer', async () => {
  const { log, w } = base(); let clock = 0;
  const slow = { ...w, budgetMs: 20, now: () => clock, upload: (t: unknown) => { log.push('up:' + String(t)); clock += 25; } };
  assert.equal(await warmFirstFrame(slow), 'timeout');
  assert.deepEqual(log, ['up:a'], 'the first map alone spent the budget: nothing more is uploaded and nothing is drawn');
});

test('the warm-up finishes with the clock frozen and no timers: a paused page still boots', async () => {
  const { log, w } = base();
  assert.equal(await warmFirstFrame({ ...w, now: () => 0, budgetMs: 1 }), 'done');
  assert.deepEqual(log, ['up:a', 'up:b', 'up:c', 'draw']);
});

test('a lost context or a throwing renderer skips the warm-up instead of failing the load', async () => {
  const { log, w } = base();
  assert.equal(await warmFirstFrame({ ...w, lost: () => true }), 'skipped');
  assert.equal(await warmFirstFrame({ ...w, draw: () => { throw new Error('GL'); } }), 'skipped');
  assert.deepEqual(log, ['up:a', 'up:b', 'up:c']);
});
