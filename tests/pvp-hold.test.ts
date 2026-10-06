import test from 'node:test';
import assert from 'node:assert/strict';
import { CATCHUP, clearHold, newHold, onFrame, onTick } from '../src/pvp-hold.ts';

type Snap = { tick: number; events: string[]; stop: number };
const stopOf = (s: Snap) => s.stop, eventsOf = (s: Snap) => s.events;
const snap = (tick: number, stop = 0): Snap => ({ tick, events: stop ? [`hit${tick}`] : [], stop });
const FRAME = 1000 / 60;

// One frame of a duel as main.ts runs it: n sim ticks (all of them, always), then the draw.
function run(ticksPerFrame: number[], stops: Record<number, number>) {
  const h = newHold<Snap>(); let tick = 0; const shownTicks: (number | null)[] = [], held: boolean[] = [], delivered: string[] = [];
  for (const n of ticksPerFrame) {
    const frameEvents: string[] = [];
    for (let i = 0; i < n; i++) { tick++; const s = snap(tick, stops[tick] ?? 0); frameEvents.push(...s.events); onTick(h, s, h.shown ? 0 : s.stop, frameEvents.length); }
    const d = onFrame(h, FRAME, frameEvents, stopOf, eventsOf);
    shownTicks.push(d.shown?.tick ?? null); held.push(d.held); delivered.push(...d.events);
  }
  return { h, shownTicks, held, delivered, simTicks: tick };
}

test('with no contact the hold never engages and the live tick is drawn', () => {
  const r = run([1, 1, 1], {});
  assert.deepEqual(r.shownTicks, [null, null, null]);
  assert.equal(r.simTicks, 3);
});

test('a contact holds the drawn frame for the same milliseconds a solo fight holds, while every sim tick still steps', () => {
  const r = run(new Array(12).fill(1), { 2: 50 });   // Hit = 50 ms (main.ts HIT_STOP) = 3 frames at 60 Hz
  assert.equal(r.simTicks, 12, 'the sim never pauses');
  const heldFrames = r.held.filter(Boolean).length;
  assert.equal(r.shownTicks[1], 2, 'the contact frame draws the contact tick');
  assert.ok(Math.abs(heldFrames * FRAME - 50) <= FRAME, `held ${heldFrames} frames for 50 ms`);
  assert.equal(r.shownTicks.slice(1, 1 + heldFrames).every((t) => t === 2), true, 'the picture stays on the contact tick');
});

test('queued ticks catch up CATCHUP per frame, in order, and the contact events arrive once', () => {
  assert.equal(CATCHUP, 3);
  const r = run(new Array(40).fill(1), { 2: 220 });   // a kill holds 220 ms: 13 ticks queue
  const after = r.shownTicks.slice(r.held.lastIndexOf(true) + 1).filter((t): t is number => t !== null);
  const steps = after.slice(1).map((t, i) => t - after[i]);
  assert.ok(steps.length > 0 && steps.every((d) => d <= CATCHUP + 1), 'no frame jumps further than the catch-up rate plus the live tick');
  assert.ok(after.every((t, i) => i === 0 || t > after[i - 1]), 'ticks are shown in order');
  assert.equal(r.shownTicks[r.shownTicks.length - 1], null, 'live again at the end');
  assert.deepEqual(r.delivered, ['hit2'], 'the contact event is delivered exactly once');
});

test('a second contact reached while catching up holds again, and its events are delivered once', () => {
  const r = run(new Array(30).fill(1), { 2: 50, 6: 50 });   // tick 6 is queued behind the first hold and reached during the catch-up
  assert.equal(r.simTicks, 30);
  const holds = r.held.reduce((n, v, i) => n + (v && !r.held[i - 1] ? 1 : 0), 0);
  assert.equal(holds, 2, 'two separate holds');
  assert.equal(r.shownTicks.includes(6), true);
  assert.deepEqual(r.delivered, ['hit2', 'hit6']);
  assert.equal(r.shownTicks[r.shownTicks.length - 1], null);
});

test('events after the contact tick inside the contact frame are not delivered early', () => {
  const r = run([4, 4, 4, 4], { 2: 50, 3: 50 });   // ticks 2 and 3 share a frame; 3 is queued behind 2
  assert.deepEqual(r.delivered, ['hit2', 'hit3']);
  assert.equal(r.delivered.indexOf('hit2') < r.delivered.indexOf('hit3'), true);
});

test('clearHold returns to live', () => {
  const r = run([1, 1], { 1: 220 });
  assert.ok(r.h.shown);
  clearHold(r.h);
  assert.deepEqual([r.h.shown, r.h.holdMs, r.h.queue.length], [null, 0, 0]);
});
