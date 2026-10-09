import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';

// "Flags deleted, not defaulted" (Dom 2026-10-09): these switches are gone from the release path, not turned on by default.
const REMOVED = ['HF_WALL_ROWS', 'hf-wall-rows', 'hf_wall_rows', 'deploy-hf.sh', 'DEPLOY_VPS_RECEIPTS', 'DEPLOY_ALLOW_UNASSIGNED'];

test('the removed release switches appear nowhere in scripts/ or tests/ (this file names them)', () => {
  for (const name of REMOVED) {
    const hits = execFileSync('git', ['grep', '-l', '-F', name, '--', 'scripts', 'tests'], { encoding: 'utf8' }).split('\n').filter(f => f && f !== 'tests/deploy-flags-deleted.test.ts');
    assert.deepEqual(hits, [], `${name} must not come back: ${hits.join(', ')}`);
  }
});
