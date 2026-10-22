import assert from 'node:assert/strict';
import test from 'node:test';
import { trackFrameCost } from './frame-cost.ts';

// A stand-in for three's WebGLRenderer: like the real one it zeroes info.render at the start of a render() when autoReset is on, then counts what the call drew.
function fakeRenderer(cost: (scene: unknown) => [number, number]) {
  const r = { info: { autoReset: true, render: { triangles: 0, calls: 0 } }, render(scene: unknown) { if (r.info.autoReset) { r.info.render.triangles = 0; r.info.render.calls = 0; } const [t, c] = cost(scene); r.info.render.triangles += t; r.info.render.calls += c; } };
  return r;
}
const GAME = { name: 'game' }, QUAD = { name: 'post' };
const frame = (r: ReturnType<typeof fakeRenderer>) => { r.render(GAME); r.render(QUAD); r.render(QUAD); };   // a composer frame: the scene pass, then two post passes
const cost = (s: unknown): [number, number] => (s === GAME ? [488_830, 178] : [2, 1]);

test('before: a composer frame reads as its last pass (the bug)', () => {
  const r = fakeRenderer(cost); frame(r);
  assert.deepEqual([r.info.render.triangles, r.info.render.calls], [2, 1]);
});

test('a frame reports the sum over its passes and the scene pass apart from the post passes', () => {
  const r = fakeRenderer(cost), f = trackFrameCost(r, GAME);
  f.begin(); frame(r); f.end();
  assert.deepEqual(f.read(), { triangles: 488_834, calls: 180, passes: 3, scene: { triangles: 488_830, calls: 178 } });
});

test('each frame stands alone: the next begin() starts from zero, and a render outside a frame counts toward none', () => {
  const r = fakeRenderer(cost), f = trackFrameCost(r, GAME);
  f.begin(); frame(r); f.end();
  r.render(GAME);   // a warm-up draw between frames (warm-proxy, gear stage)
  f.begin(); r.render(GAME); f.end();   // a frame with no post pass
  assert.deepEqual(f.read(), { triangles: 488_830, calls: 178, passes: 1, scene: { triangles: 488_830, calls: 178 } });
});

test('before any frame the reading is zero, not stale', () => {
  const r = fakeRenderer(cost), f = trackFrameCost(r, GAME);
  assert.deepEqual(f.read(), { triangles: 0, calls: 0, passes: 0, scene: { triangles: 0, calls: 0 } });
});
