// S1 build item (docs/specs/origins/s1-load-test.md §4): the presence load test reports the p99 tick next to the longest one. The rank rule is pinned here, and the health route
// hands out the recorded tick durations the script computes it from.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { percentile, tickStats } from '../origins/presence/ticks.ts';
import { createPresence } from '../origins/presence/server.ts';

test('percentile: nearest rank, so p99 of 100 samples is the 99th and one slow tick in 200 is not the p99', () => {
  const hundred = Array.from({ length: 100 }, (_, i) => i + 1).reverse();   // unsorted on purpose
  assert.equal(percentile(hundred, 50), 50);
  assert.equal(percentile(hundred, 99), 99, 'rank ceil(0.99 * 100) = 99');
  assert.equal(percentile(hundred, 100), 100);
  assert.equal(percentile(hundred, 1), 1);
  assert.equal(percentile([7], 99), 7, 'one sample is every percentile');
  assert.equal(percentile([], 99), null, 'no samples, no answer');
  const oneFifty = Array.from({ length: 150 }, (_, i) => i + 1);
  assert.equal(percentile(oneFifty, 99), 149, 'a fractional rank (148.5) rounds UP to the 149th: rounding down would hide a slow tick');
  assert.equal(percentile([1, 2, 3], 50), 2, 'rank ceil(1.5) = 2');
  const flat = [...Array.from({ length: 199 }, () => 3), 90];   // 199 ordinary ticks and one stall: the max is 90, the p99 is not
  assert.equal(percentile(flat, 99), 3, 'rank ceil(0.99 * 200) = 198, still an ordinary tick');
  assert.deepEqual(tickStats(flat), { n: 200, p50: 3, p99: 3, max: 90 }, 'max and p99 tell different stories, which is why S1 asks for both');
  assert.deepEqual(tickStats([]), { n: 0, p50: null, p99: null, max: null });
});

test('health: ?ticks=N returns the last N recorded tick durations, none without the parameter, never more than were recorded', async () => {
  const p = createPresence({ verify: async () => null, log: () => {} });
  await new Promise<void>(r => p.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${p.port()}/origins/presence/health`;
  try {
    p.world.join('00000000-0000-4000-8000-000000000001', Date.now(), undefined, { x: 100, z: 100 });
    for (let waited = 0; ((await (await fetch(base)).json()) as { ticks: number }).ticks < 6 && waited < 3000; waited += 100) await new Promise(r => setTimeout(r, 100));
    const plain = (await (await fetch(base)).json()) as { ticks: number; tickMs?: number[] };
    assert.ok(plain.ticks >= 6, `the service has ticked (${plain.ticks})`);
    assert.equal(plain.tickMs, undefined, 'the plain health answer carries no samples');
    const three = ((await (await fetch(`${base}?ticks=3`)).json()) as { tickMs: number[] }).tickMs;
    assert.equal(three.length, 3);
    const lots = ((await (await fetch(`${base}?ticks=999999`)).json()) as { tickMs: number[]; ticks: number }), expectedMax = lots.ticks;
    assert.ok(lots.tickMs.length >= 6 && lots.tickMs.length <= expectedMax + 3, 'no more than were recorded (a tick may land between the two reads)');
    assert.ok(lots.tickMs.every(x => Number.isFinite(x) && x >= 0 && x < 1000), 'real, small durations in ms');
    assert.deepEqual(((await (await fetch(`${base}?ticks=0`)).json()) as { tickMs?: number[] }).tickMs, undefined, 'ticks=0 asks for nothing');
    assert.equal(((await (await fetch(`${base}?ticks=abc`)).json()) as { tickMs?: number[] }).tickMs, undefined, 'a non-number asks for nothing');
  } finally { await p.close(); }
});
