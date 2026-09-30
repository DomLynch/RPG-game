import test from 'node:test';
import assert from 'node:assert/strict';
import { FULL_TIER_HARD, rowVerdict } from '../scripts/rank-look-rows.mjs';

// Rows as rank-look-check.mjs names them; values are Lead's cases (2026-09-30 12:3x) and the Nightborn L1 full's measures.
const rows = (stream: number, swap: number, extra: Record<string, { value: number; limit: number }> = {}) => ({
  '2 stream-in ≤ 4 s': { value: stream, limit: 4 }, '4 swap frame ≤ 50 ms': { value: swap, limit: 50 }, '3 swap ≤ 2 s after ready': { value: 0.01, limit: 2 }, ...extra,
});
const status = (v: ReturnType<typeof rowVerdict>, prefix: string) => v.lines.find(l => l.name.startsWith(prefix))!.status;

test('rank-look rows: on a full-tier file rows 2 and 4 are a REPORT under a hard ceiling (10 s, 150 ms); the phone keeps 4 s and 50 ms', () => {
  assert.deepEqual(FULL_TIER_HARD, { '2 ': 10, '4 ': 150 });
  const full = rowVerdict(rows(8.4, 100), true);
  assert.equal(full.pass, true, 'full 8.4 s / 100 ms: shipped, reported');
  assert.equal(status(full, '2 '), 'REPORT (over)'); assert.equal(status(full, '4 '), 'REPORT (over)'); assert.equal(status(full, '3 '), 'PASS');
  assert.equal(rowVerdict(rows(11, 30), true).pass, false, 'full stream-in 11 s: over the hard 10 s');
  assert.match(status(rowVerdict(rows(11, 30), true), '2 '), /^FAIL \(over the full-tier hard 10\)/);
  assert.equal(rowVerdict(rows(3, 160), true).pass, false, 'full swap 160 ms: over the hard 150 ms');
  assert.equal(rowVerdict(rows(3, 30), true).pass, true, 'full within every bound');
  assert.equal(status(rowVerdict(rows(3, 30), true), '2 '), 'REPORT (within)');
  assert.equal(rowVerdict(rows(4.3, 30), false).pass, false, 'phone stream-in 4.3 s: the phone bound is hard');
  assert.equal(rowVerdict(rows(3, 60), false).pass, false, 'phone swap 60 ms: the phone bound is hard');
  assert.equal(status(rowVerdict(rows(3, 60), false), '4 '), 'FAIL');
  // Rows outside 2/4/5a/5c never become a report, even on a full-tier file.
  assert.equal(rowVerdict(rows(3, 30, { '3 swap ≤ 2 s after ready': { value: 3, limit: 2 } }), true).pass, false, 'row 3 stays hard on a full-tier file');
  // 5a/5c: a report on full with no ceiling; hard on the phone (the existing rule).
  assert.equal(rowVerdict(rows(3, 30, { '5a added tris ≤ 45k (net of a freed CreatureBody)': { value: 49_211, limit: 45_000 } }), true).pass, true);
  assert.equal(rowVerdict(rows(3, 30, { '5a added tris ≤ 45k (net of a freed CreatureBody)': { value: 49_211, limit: 45_000 } }), false).pass, false);
  // A non-finite measure never passes, report or not.
  assert.equal(rowVerdict(rows(NaN, 30), false).pass, false);
  assert.equal(status(rowVerdict(rows(NaN, 30), true), '2 '), 'FAIL (not measured)');
  // An unmeasured 5a/5c on a full-tier file (no hard ceiling) fails too: a report needs a number (Lead's review of #1153).
  const unmeasured = rowVerdict(rows(3, 30, { '5a added tris ≤ 45k (net of a freed CreatureBody)': { value: NaN, limit: 45_000 } }), true);
  assert.equal(unmeasured.pass, false, 'NaN 5a on a full-tier file'); assert.equal(status(unmeasured, '5a'), 'FAIL (not measured)');
});
