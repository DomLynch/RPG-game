import test from 'node:test';
import assert from 'node:assert/strict';
import { warmFirstFrame } from '../src/first-frame.ts';

const base = () => { const log: string[] = []; return { log, w: { textures: ['a', 'b', 'c'], upload: (t: unknown) => { log.push('up:' + String(t)); }, draw: () => { log.push('draw'); }, frame: () => Promise.resolve(), budgetMs: 1000, lost: () => false } }; };

test('the first-frame warm-up uploads each map once, one per frame, then draws once', async () => {
  const { log, w } = base(); let frames = 0; const counted = { ...w, frame: () => { frames++; return Promise.resolve(); } };
  assert.equal(await warmFirstFrame(counted), 'done');
  assert.deepEqual(log, ['up:a', 'up:b', 'up:c', 'draw']);
  assert.equal(frames, 4, 'a frame before each upload and before the draw');
});

test('a device that never delivers frames does not hold the card: the warm-up times out and stops touching the renderer', async () => {
  const { log, w } = base(); let release: (() => void) | undefined;
  const stalled = { ...w, budgetMs: 20, frame: () => new Promise<void>((done) => { release = done; }) };
  assert.equal(await warmFirstFrame(stalled), 'timeout');
  release?.(); await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(log, [], 'a frame arriving after the timeout uploads and draws nothing');
});

test('a lost context or a throwing renderer skips the warm-up instead of failing the load', async () => {
  const { log, w } = base();
  assert.equal(await warmFirstFrame({ ...w, lost: () => true }), 'skipped');
  assert.equal(await warmFirstFrame({ ...w, draw: () => { throw new Error('GL'); } }), 'skipped');
  assert.deepEqual(log, ['up:a', 'up:b', 'up:c']);
});
