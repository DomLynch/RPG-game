// ?taplog=1: a local STRIKE press-length meter (Strategy's tap-duration condition on the one-button heavy hold; Lead's conditions: off unless the query, local only, STRIKE down to up only, labels are rows).
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTapTimer, tapLogOn, tapStats, tapText } from '../src/fight/tap-log.ts';

test('off unless ?taplog=1', () => {
  for (const q of ['', '?onebutton=1', '?taplog=0', '?taplog=10', '?taplogger=1']) assert.equal(tapLogOn(q), false, q);
  for (const q of ['?taplog=1', '?onebutton=1&taplog=1', '?a=2;taplog=1']) assert.equal(tapLogOn(q), true, q);
});

test('median and nearest-rank p90', () => {
  assert.deepEqual(tapStats([]), { n: 0, median: 0, p90: 0 });
  assert.deepEqual(tapStats([80]), { n: 1, median: 80, p90: 80 });
  assert.deepEqual(tapStats([100, 60, 80, 120]), { n: 4, median: 90, p90: 120 }, 'even n: the mean of the middle two; p90 of 4 is the 4th');
  const thirty = Array.from({ length: 30 }, (_, i) => 50 + i * 2);   // 50..108
  assert.deepEqual(tapStats(thirty), { n: 30, median: 79, p90: 102 }, 'p90 of 30 is the 27th value (index 26 of 50..108)');
});

test('the panel text comes from the label rows', () => {
  assert.equal(tapText({ n: 30, median: 84.4, p90: 111.6 }), 'STRIKE taps  n 30  median 84 ms  p90 112 ms');
});

test('the timer measures pointerdown to pointerup per pointer and ignores an up it never saw go down, a cancel and a backwards clock', () => {
  const taps: number[] = []; const t = createTapTimer((ms) => taps.push(ms));
  t.up(1, 10);                      // began elsewhere
  t.down(1, 100); t.up(1, 187);     // 87
  t.down(2, 300); t.cancel(2); t.up(2, 400);   // cancelled: nothing
  t.down(3, 500); t.up(3, 490);     // clock went backwards: nothing
  t.down(4, 600); t.down(5, 610); t.up(5, 700); t.up(4, 720);   // two thumbs, each its own press: 90 then 120
  assert.deepEqual(taps, [87, 90, 120]);
});

test('nothing leaves the page and nothing is stored, and the page code only attaches it behind the query', () => {
  const src = readFileSync(new URL('../src/fight/tap-log.ts', import.meta.url), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  for (const banned of [/\bfetch\b/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/]) assert.doesNotMatch(src, banned, String(banned));
  assert.match(readFileSync(new URL('../src/fight/input.ts', import.meta.url), 'utf8'), /tapLogOn\(location\.search\)\) attachTapLog\(document, attackButton\)/);
});
