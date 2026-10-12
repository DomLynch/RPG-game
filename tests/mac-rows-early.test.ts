// The Mac-only rows started at the cut (Strategy + Lead 2026-10-12): release-checks.mjs runs ONLY those rows into its own receipt; scripts/mac-rows-early.sh
// records a tree-bound receipt; deploy.sh trusts the passed rows by tree, waiting while a run for that tree is still going; the Published line shows start-end.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
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
