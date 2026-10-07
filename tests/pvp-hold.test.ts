import test from 'node:test';
import assert from 'node:assert/strict';
import { CATCHUP, MAX_LAG_TICKS, clearHold, newHold, onFrame, onTick, visible } from '../src/pvp-hold.ts';

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

test('a rollback drops the queued predicted ticks: their events are still delivered, their poses are never drawn, and the screen goes live from the corrected state', () => {
  type RSnap = Snap & { gen: number };
  const h = newHold<RSnap>(); let gen = 0;
  const tickOnce = (tick: number, stop = 0) => { const s: RSnap = { tick, events: stop ? [`hit${tick}`] : [`e${tick}`], stop, gen }; onTick(h, s, h.shown ? 0 : stop, 99); };
  tickOnce(1); onFrame(h, FRAME, [], stopOf, eventsOf);
  tickOnce(2, 220);                                   // contact: a 220 ms hold
  const first = onFrame(h, FRAME, ['hit2'], stopOf, eventsOf, (s) => s.gen !== gen);
  assert.equal(first.shown?.tick, 2); assert.equal(first.held, true);
  tickOnce(3); tickOnce(4); tickOnce(5);              // predicted ticks queue behind the hold
  gen++;                                              // a rollback re-steps history: those three are stale
  const shown: (number | null)[] = [], got: string[] = [];
  for (let i = 0; i < 30; i++) { const d = onFrame(h, FRAME, [], stopOf, eventsOf, (s) => s.gen !== gen); shown.push(d.shown?.tick ?? null); got.push(...d.events); if (!h.shown) break; }
  assert.ok(shown.every((t) => t === 2 || t === null), `only the contact tick is drawn, then live: ${JSON.stringify(shown)}`);
  assert.deepEqual(got, ['e3', 'e4', 'e5'], 'the confirmed events of the dropped ticks are delivered once');
  assert.equal(h.shown, null); assert.equal(h.queue.length, 0);
});

test('the picture is never more than MAX_LAG_TICKS behind the sim, whatever the contact burst: a long hold is shortened, a contact with no room does not hold', () => {
  assert.equal(MAX_LAG_TICKS, 6);
  // A kill (220 ms = 13 ticks) holds 100 ms at most.
  const kill = run(new Array(30).fill(1), { 2: 220 });
  assert.ok(kill.held.filter(Boolean).length * FRAME <= 100 + FRAME, `the kill hold was ${kill.held.filter(Boolean).length} frames`);
  // A burst: a 90 ms contact every 3 ticks for 120 ticks, one tick a frame. The queue (ticks the screen has not shown) never passes the cap at a frame's end.
  const stops: Record<number, number> = {}; for (let t = 2; t <= 120; t += 3) stops[t] = 90;
  const h = newHold<Snap>(); let tick = 0, maxQueue = 0, heldFrames = 0; const frames = 160;
  for (let f = 0; f < frames; f++) {
    if (f < 120) { tick++; const s = snap(tick, stops[tick] ?? 0); onTick(h, s, h.shown ? 0 : s.stop, 1); }
    const d = onFrame(h, FRAME, [], stopOf, eventsOf); if (d.held) heldFrames++; maxQueue = Math.max(maxQueue, h.queue.length);
  }
  assert.ok(maxQueue <= MAX_LAG_TICKS, `the queue reached ${maxQueue} ticks`);
  assert.ok(heldFrames >= 5 && heldFrames < frames, `contacts still hold, but the screen is not frozen throughout (${heldFrames} held frames of ${frames})`);
  assert.equal(h.shown, null, 'the burst drains and the screen is live again');
});

test('visible(): while the screen is behind the sim the HUD and the end banner read the drawn snapshot, so a finish is announced when its last blow is drawn', () => {
  const live = { tick: 9, events: ['Killed'], stop: 0 }, h = newHold<Snap>();
  assert.equal(visible(h, live), live, 'live when not behind');
  onTick(h, { tick: 2, events: ['hit2'], stop: 220 }, 220, 1);   // the contact; the kill is ticks away and queued behind the hold
  onTick(h, live, 0, 1);
  assert.equal(visible(h, live).tick, 2, 'the held picture, not the live finish');
  for (let i = 0; i < 40 && h.shown; i++) onFrame(h, FRAME, [], stopOf, eventsOf);
  assert.equal(visible(h, live), live, 'after the queue drains the finish is visible');
});

test('the cap holds on EVERY frame, including slow frames that queue two ticks or more (a frame that overran the hold, CI frame timing)', () => {
  for (const pattern of [[1], [1, 1, 2], [2], [1, 2, 3], [3, 1, 1, 4]]) {
    const h = newHold<Snap>(); let tick = 0, worst = 0;
    for (let f = 0; f < 200; f++) {
      const n = f < 150 ? pattern[f % pattern.length] : 0;   // ticks the sim steps before this frame draws
      for (let i = 0; i < n; i++) { tick++; const s = snap(tick, tick % 4 === 2 ? 90 : 0); onTick(h, s, h.shown ? 0 : s.stop, 1); }
      onFrame(h, FRAME * Math.max(1, n), [], stopOf, eventsOf);   // a slow frame also lasts longer
      worst = Math.max(worst, h.queue.length);
    }
    assert.ok(worst <= MAX_LAG_TICKS, `ticks per frame ${JSON.stringify(pattern)}: the queue reached ${worst} at a frame's end`);
    assert.equal(h.shown, null, `${JSON.stringify(pattern)}: the screen is live again once the sim stops`);
  }
});
