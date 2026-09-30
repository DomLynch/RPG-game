import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseJobLog, selectWallRows, trustedRows, T4_MEDIUM_USD_PER_HOUR, costLine } from '../scripts/lib/hf-wall-rows.mjs';

const gate = JSON.parse(readFileSync('.quality-gate.json', 'utf8'));
const source = (script: string) => { try { return readFileSync(script, 'utf8'); } catch { return ''; } };

test('the T4 gets the wall-clock browser rows only: never a WebKit row, never a held row, never a virtual-clock or no-browser row', () => {
  const rows = selectWallRows(gate.release_commands, source, ['arena-audio-check']);
  assert.ok(rows.length >= 20, `wall rows: ${rows.length}`);
  for (const index of rows) {
    const command = gate.release_commands[index - 1].join(' ');
    assert.doesNotMatch(command, /--engine\s+webkit/, `${index} is a WebKit row`);
    assert.doesNotMatch(command, /arena-audio-check/, `${index} is held (row 22 until it is green in a release)`);
  }
  assert.ok(!rows.includes(gate.release_commands.findIndex((c: string[]) => c.join(' ').includes('roster-browser-check')) + 1), 'row 2 drives the virtual clock: the Mac keeps it');
  // Held rows are named by script, so the list survives a renumbering.
  const withoutHold = selectWallRows(gate.release_commands, source, []);
  assert.equal(withoutHold.length, rows.length + 1, 'lifting the hold adds exactly row 22 back');
});

test('a row is trusted ONLY when its T4 receipt says exit 0 for the deployed tree (a receipt for another tree, a failed row, a missing row: never)', () => {
  const tree = 'a'.repeat(40), other = 'b'.repeat(40);
  const receipts = [
    { index: 1, status: 0, tree, seconds: 63 },
    { index: 3, status: 0, tree: other, seconds: 64 },   // another tree: the job built something else
    { index: 4, status: 1, tree, seconds: 79 },          // failed on the T4
    { index: 6, status: 0, tree, seconds: 21 },
    { index: 8, status: 0, tree: undefined, seconds: 12 },   // no tree on the receipt at all
  ];
  assert.deepEqual(trustedRows(receipts, tree, [1, 3, 4, 6, 8, 14]), [1, 6]);
  assert.deepEqual(trustedRows(receipts, tree, [3]), [], 'the other-tree receipt alone vouches for nothing');
  assert.deepEqual(trustedRows(receipts, tree, [1, 6]), [1, 6]);
  assert.deepEqual(trustedRows(receipts, tree, [14]), [], 'a row the job never reported is not trusted');
  assert.deepEqual(trustedRows(receipts, other, [1, 6]), [], 'the deployed tree decides, not the receipt\'s own');
  assert.deepEqual(trustedRows([], tree, [1, 6]), [], 'no receipts (timeout, job error): nothing trusted');
  assert.deepEqual(trustedRows(receipts, tree, [1, 6, 99]), [1, 6], 'a row outside the selection is never trusted even with a good receipt');
});

test('the job log: HEAD/TREE from git inside the container, one receipt line per row, the cost from the job seconds', () => {
  const tree = 'c'.repeat(40), sha = 'd'.repeat(40);
  const log = [
    '=== PROBE host ===', 'noise',
    `=== HEAD ${sha} TREE ${tree} ===`,
    `=== RECEIPT {"index":1,"status":0,"seconds":63,"tree":"${tree}"} ===`,
    `=== RECEIPT {"index":22,"status":1,"seconds":48,"tree":"${tree}"} ===`,
    '=== RECEIPT not json ===',
    '=== COST seconds=555 rows_wall=438 ===',
  ].join('\n');
  const parsed = parseJobLog(log);
  assert.equal(parsed.sha, sha); assert.equal(parsed.tree, tree);
  assert.deepEqual(parsed.receipts, [{ index: 1, status: 0, seconds: 63, tree }, { index: 22, status: 1, seconds: 48, tree }]);
  assert.equal(parsed.seconds, 555);
  assert.deepEqual(parseJobLog('=== BLOCKER build failed ===\n'), { sha: null, tree: null, receipts: [], seconds: null, blocker: 'build failed' });
  assert.equal(costLine(555, 'x1'), `hf-wall-rows: job x1 ran 555 s on t4-medium ≈ $${(555 / 3600 * T4_MEDIUM_USD_PER_HOUR).toFixed(2)} at $${T4_MEDIUM_USD_PER_HOUR.toFixed(2)}/h`);
});

test('the launcher end to end with a fake hf: launch writes the job id, collect trusts only same-tree exit-0 rows, a job that never ran trusts nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hf-wall-rows-')), fake = join(dir, 'hf'), state = join(dir, 'state');
  const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(), sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const other = 'e'.repeat(40);
  // Fake hf: `jobs run` prints an id; `jobs inspect` says COMPLETED (or SCHEDULING forever with FAKE_STUCK); `jobs logs` prints receipts
  // for rows 1 (ok), 3 (ok, other tree), 6 (fail); `jobs cancel` records the cancel.
  writeFileSync(fake, `#!/bin/bash
case "$1 $2" in
  "jobs run") echo "Job started with ID: job123"; echo "View at: https://x/jobs/job123";;
  "jobs inspect") if [ -n "$FAKE_STUCK" ]; then echo '{"status": {"stage": "SCHEDULING", "message": "Waiting"}}'; else echo '{"status": {"stage": "COMPLETED", "message": null}}'; fi;;
  "jobs logs") echo "=== HEAD ${sha} TREE ${tree} ==="; echo '=== RECEIPT {"index":1,"status":0,"seconds":63,"tree":"${tree}"} ==='; echo '=== RECEIPT {"index":3,"status":0,"seconds":64,"tree":"${other}"} ==='; echo '=== RECEIPT {"index":6,"status":1,"seconds":21,"tree":"${tree}"} ==='; echo "=== COST seconds=600 rows_wall=400 ===";;
  "jobs cancel") echo cancelled > "${dir}/cancelled";;
esac`, { mode: 0o755 });
  const env = { ...process.env, HF_WALL_ROWS_HF: fake, HF_WALL_ROWS_STATE: state, HF_WALL_ROWS_ENV_FILE: join(dir, 'none'), HF_WALL_ROWS_SCHEDULE_MAX_S: '0', HF_WALL_ROWS_POLL_S: '0' };
  const run = (args: string[], extra = {}) => execFileSync(process.execPath, ['scripts/hf-wall-rows.mjs', ...args], { encoding: 'utf8', env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
  const launched = run(['launch', sha, '--rows', '1,3,6,8']);
  assert.match(launched, /^job123$/m);
  const saved = JSON.parse(readFileSync(state, 'utf8'));
  assert.equal(saved.jobId, 'job123'); assert.deepEqual(saved.rows, [1, 3, 6, 8]); assert.equal(saved.sha, sha);
  const trusted = run(['collect']);
  assert.equal(trusted.trim(), '1', 'row 1 only: 3 is for another tree, 6 failed, 8 never reported');
  const receipt = JSON.parse(readFileSync(`${state}.json`, 'utf8'));
  assert.equal(receipt.tree, tree); assert.equal(receipt.seconds, 600); assert.deepEqual(receipt.trusted, [1]);
  assert.deepEqual(receipt.untrusted, { 3: 'other-tree', 6: 'exit 1', 8: 'no-receipt' });
  // Hardware never came: the launcher cancels after the schedule grace and trusts nothing.
  run(['launch', sha, '--rows', '1,3']);
  const stuck = run(['collect'], { FAKE_STUCK: '1' });
  assert.equal(stuck.trim(), '');
  assert.equal(readFileSync(join(dir, 'cancelled'), 'utf8').trim(), 'cancelled');
});

test('deploy-hf.sh: off leaves the trusted list and source untouched; shadow tables but trusts nothing; on appends the rows the T4 proved', () => {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-hf-'));
  // A fake `node` on PATH: launch prints a job id, collect prints "1,3"; a fake `hf` so `command -v hf` succeeds.
  writeFileSync(join(dir, 'node'), '#!/bin/bash\ncase "$2" in launch) echo jobX;; collect) echo -n "1,3";; table) echo "table for $HF_WALL_ROWS";; esac\n', { mode: 0o755 });
  writeFileSync(join(dir, 'hf'), '#!/bin/bash\n', { mode: 0o755 });
  const sh = (mode: string) => execFileSync('bash', ['-c', `source scripts/lib/deploy-hf.sh; revision=x; trusted_checks="7"; trust_source="CI"; hf_wall_rows_launch; hf_wall_rows_apply; echo "job=$hf_job checks=$trusted_checks source=$trust_source"; hf_wall_rows_table`], { encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, HF_WALL_ROWS: mode } });
  assert.match(sh(''), /off \(HF_WALL_ROWS=0\)[\s\S]*job= checks=7 source=CI\n$/);
  assert.match(sh('shadow'), /shadow run — the T4 vouches for \[1,3\]; the Mac runs every row anyway\njob=jobX checks=7 source=CI\ntable for shadow/);
  assert.match(sh('on'), /job=jobX checks=7,1,3 source=CI \+ T4 job jobX \(rows 1,3\)\ntable for on/);
});
