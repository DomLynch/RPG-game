// The T4 leg is gpu-only (Dom/Lead 2026-10-12, the 40-runner work): GPU_ONLY is exactly the T4 rows whose measured CPU (SwiftShader) time misses
// the 600 s row ceiling; every other row is CI's. hf-wall-rows' own launch test (tests/hf-wall-rows.test.ts) pins that only these rows are launched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GPU_ONLY, ON_T4, ROW_CEILING_S } from '../scripts/lib/row-placement.mjs';

test('GPU_ONLY is the ceiling rule over ON_T4; row 13 (initdb as root) and row 9 (369 s on CPU) are CI rows', () => {
  const expected = ON_T4.filter(e => e.row !== 13 && (e.cpu_s == null || e.cpu_s > ROW_CEILING_S)).map(e => e.row);
  assert.deepEqual([...GPU_ONLY].sort((a, b) => a - b), expected);
  assert.ok(!GPU_ONLY.includes(13) && !GPU_ONLY.includes(9));
});
