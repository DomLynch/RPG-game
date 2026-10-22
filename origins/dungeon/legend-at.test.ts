import assert from 'node:assert/strict';
import test from 'node:test';
import { campOffset, legendAt } from './legend-at.ts';

const POOL = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];   // a 10-legend pool (one rank)
const KEY = 'z7:outer-camp-0';

test('the pick is pure: the same camp and generation give the same legend, every time', () => {
  for (let g = 0; g < 25; g++) assert.equal(legendAt(POOL, KEY, g), legendAt([...POOL], KEY, g));
  assert.equal(campOffset(KEY), campOffset(KEY));
});

test('a camp never shows the same legend twice running, and walks the whole pool in a full cycle', () => {
  const seen: string[] = [];
  for (let g = 0; g < POOL.length; g++) seen.push(legendAt(POOL, KEY, g));
  assert.equal(new Set(seen).size, POOL.length, 'every legend once in n generations');
  for (let g = 0; g < 100; g++) assert.notEqual(legendAt(POOL, KEY, g), legendAt(POOL, KEY, g + 1), `generation ${g} to ${g + 1} repeats`);
  assert.equal(legendAt(POOL, KEY, 0), legendAt(POOL, KEY, POOL.length), 'after n generations the cycle starts again');
});

test('every legend appears equally often over many generations', () => {
  const count = new Map<string, number>();
  for (let g = 0; g < POOL.length * 30; g++) { const l = legendAt(POOL, KEY, g); count.set(l, (count.get(l) ?? 0) + 1); }
  assert.deepEqual([...new Set(count.values())], [30]);
});

test('the camps of a ring do not all start on the same legend (their keys hash apart)', () => {
  const starts = new Set([0, 1, 2].map((n) => legendAt(POOL, `z7:outer-camp-${n}`, 0)));
  assert.ok(starts.size > 1, 'three camps, one starting legend');
  const ring30 = Array.from({ length: 30 }, (_, i) => `legend-${i}`);
  assert.ok(new Set(['outer', 'middle', 'floor'].flatMap((r) => [0, 1, 2].map((n) => legendAt(ring30, `z7:${r}-camp-${n}`, 0)))).size > 3);
});

test('the hash is the FNV-1a 32-bit value, fixed across platforms and restarts (pinned on known keys)', () => {
  assert.equal(campOffset(''), 0x811c9dc5);   // FNV-1a of the empty string is its offset basis
  assert.equal(campOffset('a'), 0xe40c292c);   // the published FNV-1a 32-bit test vector for "a"
  assert.equal(campOffset('foobar'), 0xbf9cf968);   // the published FNV-1a 32-bit test vector for "foobar"
});

test('a bad input is a load error, never a quiet fallback', () => {
  assert.throws(() => legendAt([], KEY, 0), /empty/);
  for (const g of [-1, 1.5, NaN, Infinity]) assert.throws(() => legendAt(POOL, KEY, g), /whole number/);
  assert.throws(() => legendAt(POOL, KEY, 0, 'shuffle' as never), /unknown rotation rule/);
});

test('a one-legend pool is that legend for every generation', () => {
  for (let g = 0; g < 5; g++) assert.equal(legendAt(['only'], KEY, g), 'only');
});
