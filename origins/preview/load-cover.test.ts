import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCover, type CoverEnv } from './load-cover.ts';

function env() {
  const log: string[] = [], later: { cb: () => void; ms: number }[] = [];
  const e: CoverEnv = { fade: (ms) => log.push(`fade ${ms}`), later: (cb, ms) => later.push({ cb, ms }), remove: () => log.push('remove'), warn: (m) => log.push(`warn ${m}`) };
  return { e, log, run: () => later.splice(0).forEach((l) => l.cb()) };
}
test('the cover holds until a frame has nothing missing, then fades and is removed once', () => {
  const t = env(), c = createCover(t.e, 400, 12000);
  c.frame(100, ['hero', 'kit']); c.frame(900, ['kit']);
  assert.deepEqual(t.log, [], 'held while anything is missing');
  c.frame(2300, []); c.frame(2316, []);
  assert.deepEqual(t.log, ['fade 400'], 'one fade, however many frames follow');
  assert.deepEqual(c.state(), { reason: 'styled', atMs: 2300 });
  t.run(); assert.deepEqual(t.log, ['fade 400', 'remove']);
});
test('a stuck load fades at the max hold and says what it was waiting for', () => {
  const t = env(), c = createCover(t.e, 400, 12000);
  c.frame(11999, ['hero']); assert.deepEqual(t.log, []);
  c.frame(12000, ['hero', 'kit']);
  assert.equal(t.log[0], 'warn load cover: no styled frame after 12000 ms; still waiting for hero, kit');
  assert.equal(t.log[1], 'fade 400'); assert.deepEqual(c.state(), { reason: 'max-hold', atMs: 12000 });
  c.frame(13000, []); assert.equal(t.log.length, 2, 'once lifted it stays lifted');
});
