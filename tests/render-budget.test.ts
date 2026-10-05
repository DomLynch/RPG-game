// The render budget (src/render-budget.ts): steps the resolution down on long frames, back up after a stable stretch, never on a lone spike, never inside the startup grace.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUDGET, budgetOn, createRenderBudget } from '../src/render-budget.ts';

const run = (b: ReturnType<typeof createRenderBudget>, seconds: number, ms: number) => { const moves: number[] = []; for (let t = 0; t < seconds; t += ms / 1000) { const s = b.update(ms / 1000, ms); if (s !== undefined) moves.push(s); } return moves; };

test('healthy frames never move it, the startup grace ignores slow frames, a lone spike never steps down', () => {
  const b = createRenderBudget();
  assert.deepEqual(run(b, BUDGET.graceS, 80), [], 'the grace');
  assert.deepEqual(run(b, 30, 16.7), []);
  assert.equal(b.update(0.25, 250), undefined, 'one stalled frame');
  assert.deepEqual(run(b, 20, 16.7), [], 'and the frames after it');
  assert.equal(b.scale, 1);
});

test('long frames step down by the drop step per cooldown, floored at the minimum; the urgent step is bigger', () => {
  const slow = createRenderBudget();
  slow.update(BUDGET.graceS, 16.7);
  const moves = run(slow, 20, 40);
  assert.ok(moves.length >= 3 && moves[0] === 0.88, `first move ${moves[0]}`);   // 1 - urgentStep: 40 ms is over the urgent line
  assert.equal(slow.scale, BUDGET.minScale); assert.equal(Math.min(...moves), BUDGET.minScale);
  const mild = createRenderBudget();
  mild.update(BUDGET.graceS, 16.7);
  assert.equal(run(mild, 6, 26)[0], 0.92, 'a 26 ms run drops by the plain step');
});

test('it recovers one step at a time only after a stable stretch, and a slow frame resets the stretch', () => {
  const b = createRenderBudget();
  b.update(BUDGET.graceS, 16.7);
  run(b, 6, 40);
  const low = b.scale;
  assert.ok(low < 1);
  assert.deepEqual(run(b, BUDGET.stableS - 2, 12), [], 'not yet stable');
  assert.equal(b.update(0.06, 60), undefined, 'one long frame resets the stretch (EMA still under the drop line)');
  const up = run(b, 90, 12);
  assert.ok(up.length >= 1 && up[0] === Math.round((low + BUDGET.recoverStep) * 100) / 100, `recover steps ${up}`);
  assert.equal(b.scale, 1);
});

test('budgetOn: only ?budget=on turns it on; the default stays the old one-shot drop', () => {
  assert.equal(budgetOn('?budget=on'), true);
  for (const search of ['', '?budget=off', '?budget=', '?budget=1', '?gfx=phone']) assert.equal(budgetOn(search), false, search);
});
