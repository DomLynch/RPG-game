import assert from 'node:assert/strict';
import test from 'node:test';
import { CROWD_MAX, FrameStats, crowdWanted, readout, walkerAt, walkers } from './crowd.ts';

test('the flag is off unless ?chars is a positive number, and capped', () => {
  assert.equal(crowdWanted(''), 0); assert.equal(crowdWanted('?region=1'), 0); assert.equal(crowdWanted('?chars=abc'), 0); assert.equal(crowdWanted('?chars=0'), 0);
  assert.equal(crowdWanted('?chars=40'), 40); assert.equal(crowdWanted('?x=1&chars=7.9'), 7); assert.equal(crowdWanted('?chars=9999'), CROWD_MAX);
});
test('walkers are deterministic, n long, and move at walking speed', () => {
  const a = walkers(40), b = walkers(40); assert.equal(a.length, 40); assert.deepEqual(a, b);
  for (const w of a) { const p = walkerAt(w, 0, { x: 0, z: 0 }), q = walkerAt(w, 1, { x: 0, z: 0 }); assert.ok(Math.hypot(q.x - p.x, q.z - p.z) < 2.5); assert.ok(w.w * w.r !== 0); }
});
test('frame stats skip warm-up, drop a backgrounded gap, and report fps, worst, p95', () => {
  const s = new FrameStats(2); for (const ms of [500, 500, 16, 16, 16, 100, 5000]) s.add(ms);
  assert.equal(s.frames, 4); assert.equal(s.worst, 100); assert.equal(s.p95(), 100); assert.ok(Math.abs(s.fps - 4000 / 148) < 1e-9);
  assert.match(readout(40, s), /^40 chars · 27\.0 fps avg · worst gap 100 ms/); assert.match(readout(40, new FrameStats()), /warming up/);
});
