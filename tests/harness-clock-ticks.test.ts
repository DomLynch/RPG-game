// scripts/lib/harness-clock.mjs tickWaiter: a wait whose budget is sim ticks, not page ms (the K3g tell wait: page time ran 20 s while the sim stood still).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tickWaiter, READ_TICK } from '../scripts/lib/harness-clock.mjs';

// A stand-in page: evaluate(READ_TICK) answers the tick, any other function is the predicate run against the same state; run(ms) advances page time and, while the sim is "live", one tick per 16 ms.
function fake(opts: { live: boolean; tick?: number; noTick?: boolean }) {
  const s = { tick: opts.tick ?? 0, pageMs: 0, live: opts.live };
  const page = { evaluate: async (fn: unknown, arg?: unknown) => (fn === READ_TICK ? (opts.noTick ? NaN : s.tick) : (fn as (a?: unknown) => unknown)(arg)) };
  const run = async (ms: number) => { s.pageMs += ms; if (s.live) s.tick += Math.round(ms / 16); };
  return { s, wait: tickWaiter(page, run) };
}

test('the budget is sim ticks: a predicate met after 50 ticks returns 50', async () => {
  const { s, wait } = fake({ live: true, tick: 100 });
  assert.equal(await wait(() => s.tick - 100 >= 50, 1200), 50);
});

test('a live sim that never meets the predicate fails on the TICK budget, naming ticks not ms', async () => {
  const { s, wait } = fake({ live: true });
  await assert.rejects(() => wait(() => false, 40), /not met within 40 sim ticks/);
  assert.equal(s.pageMs, 40 * 16, 'the budget ran out after exactly 40 ticks of page frames');
});

test('a standing sim fails fast with the stall named, not after the whole tick budget of page time', async () => {
  const { s, wait } = fake({ live: false, tick: 7 });
  await assert.rejects(() => wait(() => false, 1200, undefined, 5000), /sim did not tick for 5000 ms of page time \(tick 7\)/);
  assert.ok(s.pageMs <= 5000 + 16, `stopped at the stall limit (${s.pageMs} ms), not at 1200 ticks x 16 ms`);
});

test('a page with no #debug tick is a clear error, not a silent hang', async () => {
  const { wait } = fake({ live: true, noTick: true });
  await assert.rejects(() => wait(() => true), /no sim tick to count/);
});
