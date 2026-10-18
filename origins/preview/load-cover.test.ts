import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCover, type CoverEnv } from './load-cover.ts';

// A fake page: a clock, a timer queue run by `advance`, and a settable list of what is missing.
function page(missing: string[]) {
  const log: string[] = [], timers: { at: number; cb: () => void }[] = [];
  let now = 0;
  const e: CoverEnv = { fade: (ms) => log.push(`fade ${ms}`), later: (cb, ms) => timers.push({ at: now + ms, cb }), remove: () => log.push('remove'), warn: (m) => log.push(`warn ${m}`), now: () => now, missing: () => missing };
  const advance = (ms: number) => { const to = now + ms; for (;;) { const next = timers.filter((t) => t.at <= to).sort((a, b) => a.at - b.at)[0]; if (!next) break; timers.splice(timers.indexOf(next), 1); now = next.at; next.cb(); } now = to; };
  return { e, log, advance, missing };
}
test('the cover holds until a frame has nothing missing, then fades and is removed once', () => {
  const p = page(['hero', 'kit']), c = createCover(p.e, 400, 12000);
  p.advance(100); c.frame(); p.advance(800); p.missing.splice(0, 1); c.frame();
  assert.deepEqual(p.log, [], 'held while anything is missing');
  p.advance(1400); p.missing.length = 0; c.frame(); c.frame();
  assert.deepEqual(p.log, ['fade 400'], 'one fade, however many frames follow');
  assert.deepEqual(c.state(), { reason: 'styled', atMs: 2300 });
  p.advance(400); assert.deepEqual(p.log, ['fade 400', 'remove']);
  p.advance(20000); assert.equal(p.log.length, 2, 'the max-hold timer finds it already lifted and does nothing');
});
test('the max hold is wall-clock: with ZERO frames drawn the cover still fades at the hold and says what it was waiting for', () => {
  const p = page(['hero', 'kit']), c = createCover(p.e, 400, 12000);
  p.advance(11999); assert.deepEqual(p.log, []);   // no frame() call at all: a frame-driven hold would sit here forever
  p.advance(1);
  assert.equal(p.log[0], 'warn load cover: no styled frame after 12000 ms; still waiting for hero, kit');
  assert.equal(p.log[1], 'fade 400'); assert.deepEqual(c.state(), { reason: 'max-hold', atMs: 12000 });
  p.advance(400); assert.equal(p.log[2], 'remove');
  c.frame(); p.missing.length = 0; c.frame(); assert.equal(p.log.length, 3, 'once lifted it stays lifted');
});
test('a hold that fires with nothing listed missing (no frame drawn yet) still names the cause', () => {
  const p = page([]); createCover(p.e, 400, 5000); p.advance(5000);
  assert.equal(p.log[0], 'warn load cover: no styled frame after 5000 ms; still waiting for a drawn frame');
});
