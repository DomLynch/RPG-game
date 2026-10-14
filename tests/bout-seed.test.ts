// The bout seed is one pure integer function: pinned outputs (a change moves every world record's rolls, so it needs a WORLD_SIM bump), a u32 range, and token and tick both matter.
import assert from 'node:assert/strict';
import test from 'node:test';
import { hash32 } from '../src/fight/bout-seed.ts';

const CASES: [string, number][] = [['', 0], ['tok-a', 0], ['tok-a', 1], ['tok-b', 1], ['0f3a9c2e-7b41-4d0e-9a55-1c2d3e4f5a6b', 4321], ['tok-a', -1]];
const PINNED = [91794203, 3790736182, 726009086, 3324334226, 1763057173, 3522554975];
test('hash32 digest: pinned values, u32, deterministic, token and tick both matter', () => {
  const got = CASES.map(([t, k]) => hash32(t, k));
  for (const g of got) assert.ok(Number.isInteger(g) && g >= 0 && g <= 0xffffffff);
  assert.equal(new Set(got).size, got.length);
  assert.deepEqual(got, PINNED, 'pinned digest');
});
