import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paceOf, startLog } from './pace.ts';
import SERVER_RULES from './server-rules.json' with { type: 'json' };

const TPS = 60;

test('pace rows: slow at 3x wall against sim, never under 3 s of sim time, 5000 starts kept', () => {
  const r = SERVER_RULES.pace[0]!;
  assert.deepEqual([r.slowRatio, r.minTickS, r.startsKept], [3, 3, 5000]);
});

test('an honest 60 fps fight (wall = sim) is not flagged', () => {
  const p = paceOf(10, 10 * TPS)!;
  assert.equal(p.ratio, 1); assert.equal(p.slow, false); assert.equal(p.tickS, 10); assert.equal(p.wallS, 10);
});

test('a 10%-speed fight (10x) is flagged slow', () => {
  const p = paceOf(100, 10 * TPS)!;
  assert.equal(p.ratio, 10); assert.equal(p.slow, true);
});

test('a 43%-speed fight (about 2.3x, the 8.6 fps phone) is NOT flagged', () => {
  const p = paceOf(23, 10 * TPS)!;
  assert.equal(p.ratio, 2.3); assert.equal(p.slow, false);
});

test('exactly 3x is flagged; a fight under 3 s of sim time is never flagged (null, however slow)', () => {
  assert.equal(paceOf(30, 10 * TPS)!.slow, true);
  assert.equal(paceOf(600, 2.9 * TPS), null);
  assert.equal(paceOf(9, 3 * TPS)!.slow, true, '3 s of sim time is long enough to tell');
});

test('unusable input gives no flag', () => {
  assert.equal(paceOf(NaN, 600), null); assert.equal(paceOf(-1, 600), null); assert.equal(paceOf(10, 0), null); assert.equal(paceOf(10, 1.5), null);
});

test('startLog: take returns the start once, and the oldest start is dropped past the cap', () => {
  const log = startLog(2);
  log.note('a', 1); log.note('b', 2); log.note('c', 3);
  assert.equal(log.take('a'), undefined, 'the oldest fell off');
  assert.equal(log.take('b'), 2); assert.equal(log.take('b'), undefined, 'taken once');
  assert.equal(log.take('c'), 3);
});
