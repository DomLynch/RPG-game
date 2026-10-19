import assert from 'node:assert/strict';
import { test } from 'node:test';
import { portion, shares, thin } from './damage-share.ts';
import SERVER_RULES from './server-rules.json' with { type: 'json' };

const ROWS = SERVER_RULES.worldShare[0]!;
const rows = { qualifyOfTop: ROWS.qualifyOfTop, tagExpiryS: ROWS.tagExpiryS };
const sum = (m: Map<string, number>): number => [...m.values()].reduce((a, b) => a + b, 0);

test('a solo kill pays 100%', () => {
  assert.equal(shares([{ id: 'a', damage: 100 }], 100, rows).get('a'), 1);
  assert.equal(shares([{ id: 'a', damage: 400 }], 100, rows).get('a'), 1);   // damage over the bar is capped
});

test('kill steal: the last blow earns only its share, the top share earns the rest', () => {
  // hp 100: B dealt 80, A (who landed the killing blow) dealt 20. Neither reached the bar alone; the order is not an input.
  const s = shares([{ id: 'a-last', damage: 20 }, { id: 'b-top', damage: 80 }], 100, rows);
  assert.equal(s.get('a-last'), 0.2);
  assert.equal(s.get('b-top'), 0.8);
  assert.equal(shares([{ id: 'b-top', damage: 80 }, { id: 'a-last', damage: 20 }], 100, rows).get('a-last'), 0.2);   // same in the other order
});

test('a contributor under 25% of the top share does not qualify, and the rest split the whole', () => {
  const s = shares([{ id: 'drive-by', damage: 10 }, { id: 'a', damage: 50 }, { id: 'b', damage: 30 }], 100, rows);
  assert.equal(s.get('drive-by'), 0);
  assert.equal(s.get('a'), 50 / 80);
  assert.equal(s.get('b'), 30 / 80);
  assert.ok(Math.abs(sum(s) - 1) < 1e-12);
});

test('exactly 25% of the top qualifies', () => {
  assert.ok(shares([{ id: 'a', damage: 80 }, { id: 'b', damage: 20 }], 100, rows).get('b')! > 0);
});

test('a full bar alone is a solo kill at 100% even beside another full bar (interim rule); a smaller qualifier gets its fraction of the bar', () => {
  const s = shares([{ id: 'a', damage: 100 }, { id: 'b', damage: 100 }, { id: 'c', damage: 40 }, { id: 'd', damage: 10 }], 100, rows);
  assert.equal(s.get('a'), 1);
  assert.equal(s.get('b'), 1);
  assert.equal(s.get('c'), 0.4);
  assert.equal(s.get('d'), 0);   // under 25% of the top (100): out
});

test('entries expire tagExpiryS after the contributor\'s last hit', () => {
  const s = shares([{ id: 'old', damage: 60, ageS: ROWS.tagExpiryS + 1 }, { id: 'new', damage: 40, ageS: 0 }], 100, rows);
  assert.equal(s.get('old'), 0);
  assert.equal(s.get('new'), 1);
  assert.equal(shares([{ id: 'edge', damage: 60, ageS: ROWS.tagExpiryS }], 100, rows).get('edge'), 1);   // exactly at the limit still counts
});

test('no damage, bad damage or no health pays nothing', () => {
  assert.equal(shares([{ id: 'a', damage: 0 }], 100, rows).get('a'), 0);
  assert.equal(shares([{ id: 'a', damage: Number.NaN }], 100, rows).get('a'), 0);
  assert.equal(shares([{ id: 'a', damage: 10 }], 0, rows).get('a'), 0);
});

test('thin keeps a deterministic share of the drops, all at share 1, none at share 0', () => {
  const items = Array.from({ length: 1000 }, (_, i) => i);
  assert.equal(thin(items, 1, 7).length, 1000);
  assert.equal(thin(items, 0, 7).length, 0);
  const half = thin(items, 0.5, 12345);
  assert.deepEqual(half, thin(items, 0.5, 12345));
  assert.ok(half.length > 420 && half.length < 580, `kept ${half.length} of 1000 at 0.5`);
});

test('portion floors a share of a divisible amount and never exceeds the whole', () => {
  assert.equal(portion(10, 1), 10);
  assert.equal(portion(10, 0.25), 2);
  assert.equal(portion(10, 0), 0);
  assert.equal(portion(3, 0.99), 2);
});
