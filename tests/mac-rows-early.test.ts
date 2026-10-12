// The Mac-only rows started at the cut (Strategy + Lead 2026-10-12): release-checks.mjs runs ONLY those rows into its own receipt; scripts/mac-rows-early.sh
// records a tree-bound receipt; deploy.sh trusts the passed rows by tree, waiting while a run for that tree is still going; the Published line shows start-end.
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { findReceipt, receiptFrom, runningFor, trust } from '../scripts/lib/mac-rows-early.mjs';
import { MAC_ROWS } from '../scripts/lib/row-placement.mjs';
import { earlyMacText, summaryLine } from '../scripts/lib/published-summary.mjs';

const TREE = 'a'.repeat(40), SHA = 'b'.repeat(40);
const receipt = (over: Record<string, unknown> = {}) => ({ kind: 'mac-rows-early', sha: SHA, tree: TREE, rows: [2, 4], ran: [2, 4, 22], started: '2026-10-12T14:00:00Z', ended: '2026-10-12T14:09:00Z', exit: 1, ...over });

test('receiptFrom: the rows release-checks ran; all passed only when it exited 0 with passed: true', () => {
  const checks = { passed: true, checks_detail: [{ index: 2, seconds: 70 }, { index: 4, seconds: 30 }, { index: 9, seconds: 0, trusted: 'CI' }] };
  assert.deepEqual(receiptFrom({ sha: SHA, tree: TREE, checks, started: 's', ended: 'e', exit: 0 }).rows, [2, 4]);
  const failed = receiptFrom({ sha: SHA, tree: TREE, checks: null, started: 's', ended: 'e', exit: 1 });
  assert.deepEqual([failed.rows, failed.ran], [[], []], 'a red run vouches for nothing: every Mac row runs in deploy.sh');
});

test('a red early run vouches for nothing (Auditor LOW on #2353): exit != 0 OR passed: false trusts no row, at record and at trust', () => {
  const checks = (passed: boolean) => ({ passed, checks_detail: [{ index: 2, seconds: 70 }, { index: 4, seconds: 30 }] });
  assert.deepEqual(receiptFrom({ sha: SHA, tree: TREE, checks: checks(true), started: 's', ended: 'e', exit: 1 }).rows, [], 'exit 1 with passed: true');
  assert.deepEqual(receiptFrom({ sha: SHA, tree: TREE, checks: checks(false), started: 's', ended: 'e', exit: 0 }).rows, [], 'exit 0 with passed: false');
  assert.deepEqual(receiptFrom({ sha: SHA, tree: TREE, checks: checks(true), started: 's', ended: 'e', exit: 0 }).rows, [2, 4], 'only a green run vouches');
  const dir = mkdtempSync(join(tmpdir(), 'macrows-red-'));
  try {
    writeFileSync(join(dir, `${SHA}.macrows.json`), JSON.stringify(receiptFrom({ sha: SHA, tree: TREE, checks: checks(true), started: 's', ended: 'e', exit: 1 })));
    const t = trust(dir, TREE);
    assert.deepEqual(t.receipt?.rows, [], 'the red receipt is found but trusts no row');
    assert.match(t.why, /0\/2 passed .*; the rest run here/);
    // the CLI deploy.sh calls prints nothing to trust for that tree
    const repo = mkdtempSync(join(tmpdir(), 'macrows-red-repo-'));
    execFileSync('git', ['init', '-q', repo]); execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'c']);
    const tree = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
    writeFileSync(join(dir, `${SHA}.macrows.json`), JSON.stringify(receiptFrom({ sha: SHA, tree, checks: checks(false), started: 's', ended: 'e', exit: 0 })));
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/lib/mac-rows-early.mjs'), 'trust', 'HEAD'], { cwd: repo, encoding: 'utf8', env: { ...process.env, PRELAUNCH_DIR: dir } });
    assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout, '', 'deploy.sh trusts no row from a red run');
    rmSync(repo, { recursive: true, force: true });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('trust never vouches for a row that is not a Mac row (Auditor LOW on #2353): the receipt\'s rows are intersected with MAC_ROWS', () => {
  const dir = mkdtempSync(join(tmpdir(), 'macrows-only-'));
  try {
    const nonMac = [1, 3, 9, 13].find(n => !MAC_ROWS.includes(n))!;
    writeFileSync(join(dir, `${SHA}.macrows.json`), JSON.stringify(receipt({ rows: [MAC_ROWS[0], nonMac], ran: [MAC_ROWS[0], nonMac] })));
    assert.deepEqual(trust(dir, TREE).receipt?.rows, [MAC_ROWS[0]], `row ${nonMac} is not a Mac row: never trusted from an early receipt`);
    assert.deepEqual(receiptFrom({ sha: SHA, tree: TREE, checks: { passed: true, checks_detail: [{ index: MAC_ROWS[0] }, { index: nonMac }] }, started: 's', ended: 'e', exit: 0 }).rows, [MAC_ROWS[0]], 'nor recorded as passed');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('trust: by TREE; waits (bounded) only while a live run for that tree is going; a dead run or no run is not waited for', () => {
  const dir = mkdtempSync(join(tmpdir(), 'macrows-'));
  try {
    assert.equal(trust(dir, TREE).receipt, null);
    writeFileSync(join(dir, `${'c'.repeat(40)}.macrows.json`), JSON.stringify(receipt({ tree: 'f'.repeat(40) })));
    assert.equal(findReceipt(dir, TREE), null, 'another tree never counts');
    // a live run for this tree (this test's own pid), whose receipt lands after two polls
    writeFileSync(join(dir, `${SHA}.macrows.running`), JSON.stringify({ pid: process.pid, sha: SHA, tree: TREE, started: 's' }));
    assert.ok(runningFor(dir, TREE));
    let polls = 0;
    const sleep = () => { if (++polls === 2) writeFileSync(join(dir, `${SHA}.macrows.json`), JSON.stringify(receipt())); };
    const t = trust(dir, TREE, { waitS: 60, sleep });
    assert.deepEqual(t.receipt?.rows, [2, 4]);
    assert.equal(polls, 2);
    assert.match(t.why, /mac rows \(early, from the cut\): 2\/3 passed on tree aaaaaaa \(bbbbbbbbb\), 2026-10-12T14:00:00Z - 2026-10-12T14:09:00Z; the rest run here/);
    rmSync(join(dir, `${SHA}.macrows.json`));
    let clock = 0;
    const bounded = trust(dir, TREE, { waitS: 30, sleep: (s: number) => { clock += s * 1000; }, now: () => clock });
    assert.equal(bounded.receipt, null); assert.match(bounded.why, /still running after 30s; they run here/);
    writeFileSync(join(dir, `${SHA}.macrows.running`), JSON.stringify({ pid: 999999, sha: SHA, tree: TREE, started: 's' }));
    let slept = 0;
    assert.match(trust(dir, TREE, { waitS: 60, sleep: () => { slept++; } }).why, /no run for this tree/); assert.equal(slept, 0, 'a dead run is not waited for');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('release-checks.mjs RELEASE_CHECKS_ONLY: only those rows run, into RELEASE_CHECKS_RECEIPT; the release receipt and the full-run stamp are untouched', () => {
  const root = mkdtempSync(join(tmpdir(), 'rc-only-'));
  try {
    const row = (n: number) => ['node', '-e', `require('fs').appendFileSync(${JSON.stringify(join(root, 'ran'))}, '${n}\\n')`];
    writeFileSync(join(root, '.quality-gate.json'), JSON.stringify({ commands: [['true']], release_commands: [row(1), row(2), row(3), row(4)] }));
    execFileSync('git', ['init', '-q', root]); execFileSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'c']);
    const out = join(root, 'early.json');
    const r = spawnSync(process.execPath, ['scripts/release-checks.mjs', root], { encoding: 'utf8', env: { ...process.env, RELEASE_CHECKS_ONLY: '2,4', RELEASE_CHECKS_RECEIPT: out, RELEASE_CHECKS_LOG_DIR: join(root, 'logs'), RELEASE_CHECK_CONCURRENCY: '1', RELEASE_CHECKS_SKIP: '', RELEASE_CHECKS_OUT_OF_SCOPE: '', DEPLOY_TRUST_ROWS: '' } });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.deepEqual(readFileSync(join(root, 'ran'), 'utf8').trim().split('\n').sort(), ['2', '4']);
    assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')).checks_detail.map((d: { index: number }) => d.index), [2, 4]);
    assert.ok(!existsSync(join(root, 'artifacts', 'release-checks.json')), 'the release receipt is not written');
    assert.ok(!existsSync(join(root, 'artifacts', 'last-full-release.json')), 'a subset is never a full run');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('mac-rows-early.sh: MAC_ROWS only, under the Mac-rows lock, a tree-bound receipt; a second call for the same sha does nothing', () => {
  const base = mkdtempSync(join(tmpdir(), 'mre-')), state = join(base, 'state'), dir = join(base, 'wt');
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
  mkdirSync(state);
  // the row run is stubbed: it records the env it got and writes a passing release-checks receipt for exactly the rows it was given
  const run = `echo "$RELEASE_CHECKS_ONLY|$RELEASE_CHECK_CONCURRENCY" > ${join(base, 'env')}; ls ${join(base, 'locks')} > ${join(base, 'held')}; node -e 'const rows=process.env.RELEASE_CHECKS_ONLY.split(",").map(Number); require("fs").writeFileSync(process.env.RELEASE_CHECKS_RECEIPT, JSON.stringify({passed:true,checks_detail:rows.map(index=>({index,seconds:1}))}))'`;
  const env = { ...process.env, PRELAUNCH_DIR: state, MAC_ROWS_DIR: dir, MAC_ROWS_INSTALL: 'true', MAC_ROWS_RUN: run, DEPLOY_LOCK: join(base, 'locks', 'in_flight.json'), DEPLOY_ROWS_LOCK: join(base, 'locks', 'rows.lock') };
  mkdirSync(join(base, 'locks'));
  try {
    const r = spawnSync('bash', ['scripts/mac-rows-early.sh', sha], { encoding: 'utf8', env, timeout: 120_000 });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(readFileSync(join(base, 'env'), 'utf8').trim(), `${MAC_ROWS.join(',')}|1`, 'only the Mac rows, one at a time');
    assert.match(readFileSync(join(base, 'held'), 'utf8'), /rows\.lock/, 'the rows ran under deploy.sh\'s Mac-rows lock');
    const rec = JSON.parse(readFileSync(join(state, `${sha}.macrows.json`), 'utf8'));
    assert.deepEqual([rec.kind, rec.sha, rec.tree, rec.rows, rec.exit], ['mac-rows-early', sha, tree, MAC_ROWS, 0]);
    assert.ok(!existsSync(join(state, `${sha}.macrows.running`)) && !existsSync(join(base, 'locks', 'rows.lock')), 'marker and lock released');
    const again = spawnSync('bash', ['scripts/mac-rows-early.sh', sha], { encoding: 'utf8', env });
    assert.match(again.stdout, /already has a receipt/);
    assert.equal(spawnSync('bash', ['scripts/mac-rows-early.sh', 'abc'], { encoding: 'utf8', env }).status, 2);
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', dir]);
    rmSync(base, { recursive: true, force: true });
  }
});

test('mac-rows-early.sh never overlaps a deploy\'s Mac rows: while deploy_rows.lock is held by a live pid it starts no row and writes no running marker', () => {
  const base = mkdtempSync(join(tmpdir(), 'mre-held-')), state = join(base, 'state'), dir = join(base, 'wt'), locks = join(base, 'locks');
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  mkdirSync(state); mkdirSync(locks);
  const rowsLock = join(locks, 'deploy_rows.lock');
  const run = `date +%s%N > ${join(base, 'rows-started')}; node -e 'require("fs").writeFileSync(process.env.RELEASE_CHECKS_RECEIPT, JSON.stringify({passed:true,checks_detail:[]}))'`;
  const env = { ...process.env, PRELAUNCH_DIR: state, MAC_ROWS_DIR: dir, MAC_ROWS_INSTALL: 'true', MAC_ROWS_RUN: run, DEPLOY_LOCK: join(locks, 'in_flight.json'), DEPLOY_ROWS_LOCK: rowsLock, DEPLOY_LOCK_POLL_S: '1' };
  // a deploy.sh in its own Mac rows: the lock dir holds a live pid
  const holder = spawn('sleep', ['60']);
  const take = () => { mkdirSync(rowsLock); writeFileSync(join(rowsLock, 'pid'), String(holder.pid)); writeFileSync(join(rowsLock, 'revision'), 'deploy'); };
  try {
    take();
    // 1) the holder never lets go: the early run gives up, no row ran, no receipt, no marker a deploy could wait on, and the deploy's lock is untouched
    const gaveUp = spawnSync('bash', ['scripts/mac-rows-early.sh', sha], { encoding: 'utf8', env: { ...env, DEPLOY_LOCK_WAIT_S: '3' }, timeout: 120_000 });
    assert.equal(gaveUp.status, 1, gaveUp.stderr + gaveUp.stdout);
    assert.match(gaveUp.stderr, /Mac rows \(early, [0-9a-f]{9}\) lock: still held by pid \d+ \(deploy\)/);
    assert.ok(!existsSync(join(base, 'rows-started')), 'no row started while the deploy held the lock');
    assert.ok(!existsSync(join(state, `${sha}.macrows.json`)) && !existsSync(join(state, `${sha}.macrows.running`)));
    assert.equal(readFileSync(join(rowsLock, 'pid'), 'utf8'), String(holder.pid), 'the deploy still holds its lock');
    // 2) while it waits there is no running marker, so deploy.sh's trust() does not wait on it; the rows start only after the deploy drops the lock
    const waiter = spawnSync('bash', ['-c', `bash scripts/mac-rows-early.sh ${sha} & w=$!; sleep 2; ls ${state} > ${join(base, 'while-waiting')}; date +%s%N > ${join(base, 'dropped')}; rm -rf ${rowsLock}; wait $w`], { encoding: 'utf8', env: { ...env, DEPLOY_LOCK_WAIT_S: '60' }, timeout: 120_000 });
    assert.equal(waiter.status, 0, waiter.stderr + waiter.stdout);
    assert.doesNotMatch(readFileSync(join(base, 'while-waiting'), 'utf8'), /macrows\.running/);
    assert.equal(runningFor(state, execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim()), null);
    assert.ok(BigInt(readFileSync(join(base, 'rows-started'), 'utf8').trim()) > BigInt(readFileSync(join(base, 'dropped'), 'utf8').trim()), 'rows began after the deploy dropped the lock');
    assert.ok(existsSync(join(state, `${sha}.macrows.json`)));
  } finally {
    holder.kill();
    spawnSync('git', ['worktree', 'remove', '--force', dir]);
    rmSync(base, { recursive: true, force: true });
  }
});

test('deploy.sh trusts the early Mac rows by tree after taking the Mac-rows lock, and the Published summary shows their start and end', () => {
  const sh = readFileSync('scripts/deploy.sh', 'utf8');
  const at = (s: string) => { const i = sh.indexOf(s); assert.ok(i >= 0, s); return i; };
  assert.ok(at('deploy_lock_wait "$DEPLOY_ROWS_LOCK" "Mac rows"') < at('node scripts/lib/mac-rows-early.mjs trust "$revision"'));
  assert.ok(at('node scripts/lib/mac-rows-early.mjs trust "$revision"') < at('RELEASE_CHECKS_SKIP="$trusted_checks"'));
  assert.match(sh, /trusted_checks="\$\{trusted_checks:\+\$trusted_checks,\}\$\{mac_early%%\|\*\}"/);
  assert.match(sh, /published-summary\.mjs [^\n]* "\$\{mac_early:-\}" \|\| true/);
  assert.equal(earlyMacText('2,4|14:00|14:09'), '; Mac-only rows run at the cut (counted in other trusted): [2,4] 14:00 - 14:09');
  assert.equal(earlyMacText(''), '');
  const line = summaryLine({ total: 2, mac: [], ci: [], vps: [], hf: [], other: [2, 4], outOfScope: 0, retried: 0 }, '9 min', 12, '0', '2,4|14:00|14:09');
  assert.match(line, /orphaned T4 jobs: 0; Mac-only rows run at the cut \(counted in other trusted\): \[2,4\] 14:00 - 14:09$/);
});
