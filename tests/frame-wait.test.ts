import test from 'node:test';
import assert from 'node:assert/strict';
import { hiddenDriver, waitFrame, type FrameEnv } from '../origins/preview/frame-wait.ts';

test('the hidden-tab driver steps the walk until [zone ready], then never: no combat, spawn network, presence or kill report from an AFK hidden tab', () => {
  const s = { hidden: true, fighting: false, readyAt: -1 }, ticks: string[] = [];
  // the walk stands for everything walkLoop steps (the world's combat, the spawn network, presence, kill reports): any call is a step
  const tick = hiddenDriver({ hidden: () => s.hidden, held: () => s.fighting || s.readyAt >= 0 }, () => { ticks.push('walk'); });
  tick(); tick(); assert.equal(ticks.length, 2, 'it drives the warm-up while the zone is not ready');
  s.readyAt = 8900; for (let i = 0; i < 1000; i++) tick(); assert.equal(ticks.length, 2, 'after ready a hidden tab runs no walk ticks, however long it stays hidden');
  s.readyAt = -1; s.fighting = true; tick(); assert.equal(ticks.length, 2, 'a duel owns the canvas');
  s.fighting = false; s.hidden = false; tick(); assert.equal(ticks.length, 2, 'a visible tab is drawn by its own animation frames');
});

// A fake clock: raf fires only when `frame()` is called (a visible tab), timers only when `tick(ms)` reaches them.
function env(hidden: { v: boolean }) {
  const frames: (() => void)[] = [], timers: { at: number; cb: () => void }[] = [];
  let now = 0;
  const e: FrameEnv = { raf: (cb) => { frames.push(cb); }, timer: (cb, ms) => { timers.push({ at: now + ms, cb }); }, hidden: () => hidden.v };
  return { e, frame: () => frames.splice(0).forEach((f) => f()), tick: (ms: number) => { now += ms; timers.filter((t) => t.at <= now).forEach((t) => { timers.splice(timers.indexOf(t), 1); t.cb(); }); } };
}
const settled = async (p: Promise<void>) => { let ok = false; void p.then(() => { ok = true; }); await new Promise((r) => setImmediate(r)); return ok; };

test('a visible tab resolves on the frame, never on the timer', async () => {
  const h = { v: false }, f = env(h), p = waitFrame(f.e, 100, 500);
  f.tick(400); assert.equal(await settled(p), false);   // slow but visible: it keeps waiting for its frame
  f.frame(); assert.equal(await settled(p), true);
});
test('a tab already hidden resolves on the short timer without any frame', async () => {
  const h = { v: true }, f = env(h), p = waitFrame(f.e, 100, 500);
  f.tick(99); assert.equal(await settled(p), false);
  f.tick(1); assert.equal(await settled(p), true);
});
test('a tab hidden after the request resolves at the check', async () => {
  const h = { v: false }, f = env(h), p = waitFrame(f.e, 100, 500);
  h.v = true; f.tick(500); assert.equal(await settled(p), true);
});
test('a frame and a timer both firing resolve once', async () => {
  const h = { v: true }, f = env(h), p = waitFrame(f.e, 100, 500);
  f.frame(); f.tick(100); assert.equal(await settled(p), true);
});
