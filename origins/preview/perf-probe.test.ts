// The ?perf recorder (perf-probe.ts): the window opens at the tap, the worst gap and its time are right, gaps over 100 ms are listed, marks and long tasks are scoped to the window, the line says when longtask is unsupported.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Recorder, summaryLine } from './perf-probe.ts';

const feed = (r: Recorder, times: number[]) => times.forEach((t) => r.frame(t));

test('the worst gap is measured from the tap, with when it ended and every gap over 100 ms', () => {
  const r = new Recorder(); feed(r, [0, 17, 34, 51]); r.mark('tap', 60); feed(r, [77, 94, 400, 417, 434, 600, 617]);
  const s = r.summary();
  assert.equal(s.worstGapMs, 306); assert.equal(s.worstAtMs, 340); assert.deepEqual(s.gapsOver100, [306, 166]);
  assert.ok(s.frames >= 6);
});

test('gaps before the tap and after the window do not count; marks and long tasks are scoped to it', () => {
  const r = new Recorder(1000); feed(r, [0, 500, 517]); r.mark('tap', 520); r.mark('ready', 560); r.longTask(530, 70); r.longTask(3000, 400); feed(r, [537, 554, 1700, 1717]);
  const s = r.summary();
  assert.equal(s.worstGapMs, 20); assert.deepEqual(s.marks.map((m) => m.name), ['tap', 'ready']); assert.deepEqual(s.longTasks, [{ atMs: 10, ms: 70 }]);
});

test('the line carries the numbers, says when the browser has no longtask, and an empty record is a quiet zero', () => {
  const r = new Recorder(); r.mark('tap', 0); feed(r, [10, 27, 200]);
  const line = summaryLine(r.summary(), false);
  assert.match(line, /worst 173ms/); assert.match(line, /tap@0/); assert.match(line, /n\/a/);
  assert.match(summaryLine(new Recorder().summary(), true), /worst 0ms .*longtasks none/);
});
