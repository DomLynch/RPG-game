import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cpuShards } from '../scripts/vps-shadow/launch.mjs';
import { rowSet } from '../scripts/vps-shadow/rows-lib.mjs';
import { parseJobLog, selectWallRows, splitRows, trustedRows, waitBudget, HELD_ROWS, T4_MEDIUM_USD_PER_HOUR, costLine } from '../scripts/lib/hf-wall-rows.mjs';

const gate = JSON.parse(readFileSync('.quality-gate.json', 'utf8'));
// The launcher tests read HEAD and its tree: a clone without .git (the VPS work copies) has neither. CI and the Mac keep them strict.
const noGit = (() => { try { execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { stdio: 'ignore' }); return false; } catch { return 'no git history in this checkout (HEAD and its tree are unreadable)'; } })();
const source = (script: string) => { try { return readFileSync(script, 'utf8'); } catch { return ''; } };

test('the T4 gets every browser row (wall and virtual clock): never a WebKit row, never a held row, never a no-browser row', () => {
  const rows = selectWallRows(gate.release_commands, source, ['arena-audio-check']);
  assert.ok(rows.length >= 20, `wall rows: ${rows.length}`);
  // Row 22 ran green on the Mac in run BM (live 0f9a09c1, Lead 2026-09-30): no hold today, so the default selection includes it.
  assert.deepEqual(HELD_ROWS, []);
  assert.ok(selectWallRows(gate.release_commands, source).some((index: number) => gate.release_commands[index - 1].join(' ').includes('arena-audio-check')), 'row 22 is a wall row under normal rules');
  for (const index of rows) {
    const command = gate.release_commands[index - 1].join(' ');
    assert.doesNotMatch(command, /--engine\s+webkit/, `${index} is a WebKit row`);
    assert.doesNotMatch(command, /arena-audio-check/, `${index} is held (row 22 until it is green in a release)`);
  }
  const timings = new Map(rowSet(gate.release_commands, source).map((r: { index: number; timing: string }) => [r.index, r.timing]));
  assert.ok(rows.some((i: number) => timings.get(i) === 'virtual'), 'virtual-clock browser rows draw too: they go to the T4');
  for (const i of rows) assert.notEqual(timings.get(i), 'none', `row ${i} opens no browser: it stays on the CPU shard`);
  for (const [i, t] of timings) if (t !== 'none' && !/--engine\s+webkit/.test(gate.release_commands[i - 1].join(' ')) && i !== 22) assert.ok(rows.includes(i), `browser row ${i} must be on the T4 list`);
  // Held rows are named by script, so the list survives a renumbering.
  const withoutHold = selectWallRows(gate.release_commands, source, []);
  assert.equal(withoutHold.length, rows.length + 1, 'lifting the hold adds exactly row 22 back');
});

test('the HF CPU shard carries no row that draws: every CPU-shard row opens no browser (R job 6ac9806a timed out drawing on CPU)', () => {
  const timings = new Map(rowSet(gate.release_commands, source).map((r: { index: number; timing: string }) => [r.index, r.timing]));
  const cpu: number[] = cpuShards(gate.release_commands, source).flat();
  for (const i of cpu) assert.equal(timings.get(i), 'none', `CPU shard row ${i} draws`);
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

test('the launcher end to end with a fake hf: launch writes the job id, collect trusts only same-tree exit-0 rows, a job that never ran trusts nothing', { skip: noGit }, () => {
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
  assert.equal(existsSync(`${state}.json`), false, 'a new launch drops the previous receipt: deploy-hf.sh reads its presence as "collect already ran"');
  const stuck = run(['collect'], { FAKE_STUCK: '1' });
  assert.equal(stuck.trim(), '');
  assert.equal(readFileSync(join(dir, 'cancelled'), 'utf8').trim(), 'cancelled');
});

test('deploy-hf.sh: always on (no switch): it appends the rows the T4 proved, and an old HF_WALL_ROWS value changes nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-hf-'));
  // A fake `node` on PATH: launch prints a job id, collect prints "1,3"; a fake `hf` so `command -v hf` succeeds.
  writeFileSync(join(dir, 'node'), '#!/bin/bash\ncase "$2" in launch) echo jobX;; collect) echo -n "1,3";; table) echo "table for $HF_WALL_ROWS";; esac\n', { mode: 0o755 });
  writeFileSync(join(dir, 'hf'), '#!/bin/bash\n', { mode: 0o755 });
  const tree = 'a'.repeat(40); writeFileSync(join(dir, 'state.json'), JSON.stringify({ tree, trusted: [1, 3] }));
  const sh = (mode: string) => execFileSync('bash', ['-c', `exec 2>&1; source scripts/lib/deploy-hf.sh; revision=x; trusted_checks="7"; trust_source="CI"; hf_wall_rows_launch; hf_wall_rows_apply; echo "job=$hf_job checks=$trusted_checks source=$trust_source"; hf_wall_rows_table`], { encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, HF_WALL_ROWS: mode, HF_WALL_ROWS_STATE: join(dir, 'state') } });
  for (const old of ['', '0', 'shadow', 'on']) assert.match(sh(old), new RegExp(`job=jobX checks=7,1,3 source=CI \\+ T4 job jobX \\(rows 1,3; receipt tree=${tree}\\)\\ntable for ${old}`), `HF_WALL_ROWS=${old || '(unset)'}`);
});

test('collect\'s wait is capped inside the deploy ceiling: min(25 min, ceiling − elapsed − 20 min for the Mac), floor 0 (Deploy\'s review of #1194)', () => {
  const t0 = 1_000_000;   // deploy start, epoch seconds
  assert.equal(waitBudget({ ceilingS: 3000, deployT0: t0, now: t0 + 300 }), 1500, 'early in the deploy the 25-min cap binds');
  assert.equal(waitBudget({ ceilingS: 3000, deployT0: t0, now: t0 + 600 }), 1200, '10 min in: 3000 − 600 − 1200');
  assert.equal(waitBudget({ ceilingS: 3000, deployT0: t0, now: t0 + 1800 }), 0, '30 min in: nothing left once the Mac keeps its 20 min');
  assert.equal(waitBudget({ ceilingS: 3000, deployT0: t0, now: t0 + 2500 }), 0, 'never negative');
  assert.equal(waitBudget({ ceilingS: 3000, deployT0: undefined, now: t0 + 2500 }), 1500, 'no deploy clock (run by hand): the plain cap');
  assert.equal(waitBudget({ ceilingS: 3000, deployT0: t0, now: t0 + 600, waitMaxS: 900 }), 900, 'a smaller HF_WALL_ROWS_WAIT_MAX_S still binds');
});

test('the launcher honours the budget: with no wait left it cancels the job at once and trusts nothing', { skip: noGit }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'hf-wall-rows-budget-')), fake = join(dir, 'hf'), state = join(dir, 'state');
  const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(), sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync(fake, `#!/bin/bash
case "$1 $2" in
  "jobs run") echo "Job started with ID: jobB";;
  "jobs inspect") echo '{"status": {"stage": "RUNNING"}}';;
  "jobs logs") echo "=== HEAD ${sha} TREE ${tree} ==="; echo '=== RECEIPT {"index":1,"status":0,"seconds":1,"tree":"${tree}"} ===';;
  "jobs cancel") echo cancelled > "${dir}/cancelled";;
esac`, { mode: 0o755 });
  const env = { ...process.env, HF_WALL_ROWS_HF: fake, HF_WALL_ROWS_STATE: state, HF_WALL_ROWS_ENV_FILE: join(dir, 'none'), HF_WALL_ROWS_POLL_S: '0', DEPLOY_CEILING_S: '3000', HF_WALL_ROWS_DEPLOY_T0: String(Math.floor(Date.now() / 1000) - 1800) };
  const run = (args: string[]) => execFileSync(process.execPath, ['scripts/hf-wall-rows.mjs', ...args], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
  run(['launch', sha, '--rows', '1']);
  assert.equal(run(['collect']).trim(), '', '30 min into a 50-min deploy: no wait budget, the running job is cancelled, nothing trusted');
  assert.equal(readFileSync(join(dir, 'cancelled'), 'utf8').trim(), 'cancelled');
  assert.match(JSON.parse(readFileSync(`${state}.json`, 'utf8')).error, /no wait budget/);
});

test('deploy-hf.sh: the Published line carries the receipt tree, CI+T4 rows are deduped, and the EXIT-trap cancel fires only before collect', () => {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-hf2-')), tree = 'f'.repeat(40);
  writeFileSync(join(dir, 'node'), '#!/bin/bash\ncase "$2" in launch) echo jobX;; collect) echo -n "1,3";; table) :;; esac\n', { mode: 0o755 });
  writeFileSync(join(dir, 'hf'), `#!/bin/bash\n[ "$1 $2" = "jobs cancel" ] && echo "$3" >> "${dir}/cancelled"; exit 0\n`, { mode: 0o755 });
  const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, HF_WALL_ROWS_STATE: join(dir, 'state') };
  const sh = (script: string) => execFileSync('bash', ['-c', `exec 2>&1; source scripts/lib/deploy-hf.sh; revision=x; ${script}`], { encoding: 'utf8', env });
  writeFileSync(join(dir, 'state.json'), JSON.stringify({ tree, trusted: [1, 3] }));
  assert.match(sh('trusted_checks="7,1"; trust_source="CI"; hf_wall_rows_launch; hf_wall_rows_apply; echo "checks=$trusted_checks source=$trust_source"'),
    new RegExp(`checks=7,1,3 source=CI \\+ T4 job jobX \\(rows 1,3; receipt tree=${tree}\\)`), 'row 1 once, the tree on the line');
  // The trap: a job launched but not collected (no state.json) is cancelled; after collect (state.json present) it is left alone.
  rmSync(join(dir, 'state.json'));
  sh('hf_wall_rows_launch; hf_wall_rows_cancel');
  assert.equal(readFileSync(join(dir, 'cancelled'), 'utf8').trim(), 'jobX');
  writeFileSync(join(dir, 'state.json'), '{}');
  sh('hf_wall_rows_launch; hf_wall_rows_cancel');
  assert.equal(readFileSync(join(dir, 'cancelled'), 'utf8').trim(), 'jobX', 'no second cancel once collect has written its receipt');
});

test('splitRows: longest rows first onto the least-loaded job, so the parallel T4 jobs finish together; never more jobs than rows', () => {
  const secs: Record<number, number> = { 1: 90, 2: 86, 3: 55, 4: 53, 5: 53, 6: 34, 7: 23, 8: 21 };
  const jobs = splitRows([1, 2, 3, 4, 5, 6, 7, 8], 4, (row: number) => secs[row]);
  assert.equal(jobs.length, 4);
  assert.deepEqual(jobs.flat().sort((a: number, b: number) => a - b), [1, 2, 3, 4, 5, 6, 7, 8], 'every row exactly once');
  const loads = jobs.map((j: number[]) => j.reduce((sum, row) => sum + secs[row], 0));
  assert.ok(Math.max(...loads) - Math.min(...loads) <= 40, `balanced: ${loads}`);
  assert.deepEqual(splitRows([7, 3], 4), [[3], [7]], 'two rows: two jobs, not four');
  assert.deepEqual(splitRows([], 4), []);
});

test('the release selection launches T4_JOBS parallel jobs, each in the ledger; a job that fails trusts none of its own rows and the others still count', { skip: noGit }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'hf-wall-rows-multi-')), fake = join(dir, 'hf'), state = join(dir, 'state'), ledgerDir = join(dir, 'ledger');
  const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(), sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  // Fake hf: `jobs run` numbers its jobs (job1, job2, ...) and records which rows each got (from SKIP); job2 ends in ERROR; every job's log has
  // an exit-0 receipt for each of its own rows.
  writeFileSync(fake, `#!/bin/bash
case "$1 $2" in
  "jobs run") n=$(( $(cat "${dir}/n" 2>/dev/null || echo 0) + 1 )); echo $n > "${dir}/n"; for a in "$@"; do case "$a" in SKIP=*) echo "\${a#SKIP=}" > "${dir}/skip$n";; esac; done; echo "Job started with ID: job$n";;
  "jobs inspect") if [ "$3" = job2 ]; then echo '{"status": {"stage": "ERROR"}}'; else echo '{"status": {"stage": "COMPLETED"}}'; fi;;
  "jobs logs") echo "=== HEAD ${sha} TREE ${tree} ==="; for r in 1 3 6 8; do echo "=== RECEIPT {\\"index\\":$r,\\"status\\":0,\\"seconds\\":5,\\"tree\\":\\"${tree}\\"} ==="; done; echo '=== COST seconds=100 rows_wall=20 ===';;
  "jobs cancel") :;;
esac`, { mode: 0o755 });
  const total = gate.release_commands.length, keep = [1, 3, 6, 8];
  const env = { ...process.env, HF_WALL_ROWS_HF: fake, HF_WALL_ROWS_STATE: state, HF_WALL_ROWS_ENV_FILE: join(dir, 'none'), HF_WALL_ROWS_POLL_S: '0', HF_LEDGER_DIR: ledgerDir };
  const run = (args: string[]) => execFileSync(process.execPath, ['scripts/hf-wall-rows.mjs', ...args], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
  const skip = Array.from({ length: total }, (_, i) => i + 1).filter(i => !keep.includes(i)).join(',');
  assert.equal(run(['launch', sha, '--skip', skip]).trim(), 'job1,job2,job3,job4', 'four rows, four parallel jobs');
  const saved = JSON.parse(readFileSync(state, 'utf8'));
  assert.deepEqual(saved.jobs.map((j: { rows: number[] }) => j.rows).flat().sort((a: number, b: number) => a - b), keep);
  assert.equal(readFileSync(join(ledgerDir, `${sha}.ledger`), 'utf8').trim().split('\n').length, 4, 'every job is in the ledger for hf-cleanup');
  const job2Rows: number[] = saved.jobs[1].rows;
  assert.equal(readFileSync(join(dir, 'skip2'), 'utf8').trim().split(',').map(Number).filter((r: number) => keep.includes(r)).length, 3, 'each job skips the other jobs\' rows');
  const trusted = run(['collect']).trim().split(',').map(Number);
  assert.deepEqual(trusted, keep.filter(r => !job2Rows.includes(r)), 'job2 failed: only its rows fall back to the Mac');
  const receipt = JSON.parse(readFileSync(`${state}.json`, 'utf8'));
  for (const r of job2Rows) assert.equal(receipt.untrusted[r], 'job ended ERROR');
  assert.equal(receipt.seconds, 400, 'every job\'s seconds, summed: the failed one cost compute too');
  rmSync(dir, { recursive: true, force: true });
});

