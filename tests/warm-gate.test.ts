import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gateWithBound, settleWithin } from '../src/warm-gate.ts';

test('a gate whose compile never resolves still reveals within the bound, and logs "warmup timeout <archetype> <ms>"', async () => {
  const lines: string[] = [], t0 = Date.now();
  const { result } = await gateWithBound('goblin', new Promise(() => {}), 40, (l) => lines.push(l));
  assert.equal(result, 'late'); assert.ok(Date.now() - t0 < 400, 'revealed near the bound, not hung');
  assert.equal(lines.length, 1); assert.match(lines[0]!, /^warmup timeout goblin \d+$/);
});

test('a warm-up that finishes inside the bound is "ok" and logs nothing; one that throws is "failed" and still reveals', async () => {
  const lines: string[] = [];
  assert.equal((await gateWithBound('wolf', Promise.resolve(), 200, (l) => lines.push(l))).result, 'ok'); assert.equal(lines.length, 0);
  assert.equal((await gateWithBound('boar', Promise.reject(new Error('link failed')), 200, (l) => lines.push(l))).result, 'failed'); assert.match(lines[0]!, /^warmup failed boar /);
});

test('a late gate keeps its work, so the caller can wait for it before the next compile (one in flight)', async () => {
  let finished = false; const work = new Promise<void>((r) => setTimeout(() => { finished = true; r(); }, 80));
  const g = await gateWithBound('bear', work, 20, () => {}); assert.equal(g.result, 'late'); assert.equal(finished, false);
  await g.settled; assert.equal(finished, true);
});

test('a compile that never settles gives up after the bound and logs it; one that settles in time does not', async () => {
  const lines: string[] = []; const t0 = Date.now();
  assert.equal(await settleWithin('bear', new Promise(() => {}), 60, (l) => lines.push(l)), false);
  assert.ok(Date.now() - t0 < 400, 'gave up near the bound, not hung'); assert.equal(lines.length, 1); assert.match(lines[0]!, /^warmup stuck bear \d+$/);
  assert.equal(await settleWithin('wolf', new Promise<void>((r) => setTimeout(r, 10)), 200, (l) => lines.push(l)), true); assert.equal(lines.length, 1);
});
