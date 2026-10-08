import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gateWithBound } from './warm-gate.ts';

test('a gate whose compile never resolves still reveals within the bound, and logs "warmup timeout <archetype> <ms>"', async () => {
  const lines: string[] = [], t0 = Date.now();
  const { result } = await gateWithBound('goblin', new Promise(() => {}), 40, (l) => lines.push(l));
  assert.equal(result, 'late'); assert.ok(Date.now() - t0 < 400, 'revealed near the bound, not hung');
  assert.equal(lines.length, 1); assert.match(lines[0]!, /^warmup timeout goblin \d+$/);
});

test('a warm-up that finishes inside the bound is "ok" and logs nothing; one that throws is "failed" and still reveals', async () => {
  const lines: string[] = [];
  assert.equal((await gateWithBound('wolf', Promise.resolve(), 200, (l) => lines.push(l))).result, 'ok'); assert.deepEqual(lines, []);
  assert.equal((await gateWithBound('boar', Promise.reject(new Error('link failed')), 200, (l) => lines.push(l))).result, 'failed'); assert.match(lines[0]!, /^warmup failed boar /);
});

test('a late gate keeps its work, so the caller can wait for it before the next compile (one in flight)', async () => {
  let finished = false; const work = new Promise<void>((r) => setTimeout(() => { finished = true; r(); }, 80));
  const g = await gateWithBound('bear', work, 20, () => {}); assert.equal(g.result, 'late'); assert.equal(finished, false);
  await g.settled; assert.equal(finished, true);
});
