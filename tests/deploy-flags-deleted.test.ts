import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';

// "Flags deleted, not defaulted" (Dom 2026-10-09): the T4 wall rows and the HF/VPS receipts are always on; the Mac-only list (scripts/lib/row-placement.mjs)
// is the only config. The switches must not come back anywhere in scripts/ (exact names: HF_WALL_ROWS_STATE and friends are tuning, not switches).
const REMOVED = ['HF_WALL_ROWS', 'DEPLOY_VPS_RECEIPTS', 'DEPLOY_ALLOW_UNASSIGNED'];

test('the removed release switches appear nowhere in scripts/', () => {
  for (const name of REMOVED) {
    const r = spawnSync('git', ['grep', '-nE', `${name}([^A-Z_]|$)`, '--', 'scripts'], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(r.stdout.trim(), '', `${name} must not come back`);
  }
});
