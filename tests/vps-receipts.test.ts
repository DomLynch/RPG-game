import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { jobCommand, trustedFromVps, trustedFromShards, unitReceiptOk, vpsSafeRow } from '../scripts/lib/vps-receipts.mjs';
import { hfArgs, receiptFrom } from '../scripts/vps-shadow/launch.mjs';
import { rowSet } from '../scripts/vps-shadow/rows-lib.mjs';

const commands: string[][] = JSON.parse(readFileSync('.quality-gate.json', 'utf8')).release_commands;
const source = (script: string) => { try { return readFileSync(script, 'utf8'); } catch { return null; } };
const tree = 'a'.repeat(40);
type Row = { index: number; command: string; timing?: string };
const rows: Row[] = rowSet(commands, source);
const sums = { 'run-rows.sh': 'r'.repeat(64), 'rows-json.mjs': 'j'.repeat(64), 'rows-lib.mjs': 'l'.repeat(64) };
const sha = 'e'.repeat(40);
const receipt = (over = {}) => ({ kind: 'vps-shadow-rows', job: 'J1', sha, scripts: sums, tree, buildStatus: 0, dirty: 0, rows: rows.map((r: Row) => ({ ...r, status: 'pass', exit: 0 })), ...over });
// What `hf jobs inspect` says about the job a receipt names (the flavor comes from here, never from the receipt).
const jobs = (flavor = 'cpu-upgrade', over = {}, kind = 'rows') => ({ J1: { id: 'J1', flavor, status: { stage: 'COMPLETED' }, environment: { SHA: sha }, command: jobCommand(kind, sha), ...over } });
const JOBS = jobs();
const TREES = { [sha]: tree };   // `git rev-parse <receipt.sha>^{tree}` for the receipt's commit

test('a VPS pass for the deployed tree is trusted for virtual-clock and no-browser rows only: never WebKit, never wall-clock', () => {
  const trusted: number[] = trustedFromVps(receipt(), tree, commands, source, sums, JOBS, TREES);
  assert.ok(trusted.length > 0 && trusted.length < commands.length);
  // Stricter than the per-file label: the imports are read too, so a trusted row is never a wall or WebKit row by the plain label either.
  for (const row of rows) {
    const wallOrWebKit = row.timing === 'wall' || /--engine\s+webkit\b/.test(row.command);
    if (wallOrWebKit) assert.ok(!trusted.includes(row.index), `row ${row.index}`);
  }
});

test('nothing is trusted for another tree, a failed or dirty build, a failed row, or a row whose command changed', () => {
  assert.deepEqual(trustedFromVps(receipt(), 'b'.repeat(40), commands, source, sums, JOBS, TREES), []);
  assert.deepEqual(trustedFromVps(receipt(), 'short', commands, source, sums, JOBS, TREES), []);
  assert.deepEqual(trustedFromVps(receipt({ buildStatus: 1 }), tree, commands, source, sums, JOBS, TREES), []);
  assert.deepEqual(trustedFromVps(receipt({ dirty: 2 }), tree, commands, source, sums, JOBS, TREES), []);
  assert.deepEqual(trustedFromVps(null, tree, commands, source, sums, JOBS, TREES), []);
  const base: number[] = trustedFromVps(receipt(), tree, commands, source, sums, JOBS, TREES);
  const failed = receipt({ rows: rows.map((r: Row) => ({ ...r, status: r.index === base[0] ? 'fail' : 'pass', exit: r.index === base[0] ? 1 : undefined })) });
  assert.ok(!trustedFromVps(failed, tree, commands, source, sums, JOBS, TREES).includes(base[0]));
  const edited = receipt({ rows: rows.map((r: Row) => ({ ...r, status: 'pass', exit: 0, command: r.index === base[0] ? `${r.command} --x` : r.command })) });
  assert.ok(!trustedFromVps(edited, tree, commands, source, sums, JOBS, TREES).includes(base[0]));
});

test('deploy.sh applies the VPS receipts before the Mac rows, opt-in', () => {
  const deploy = readFileSync('scripts/deploy.sh', 'utf8');
  assert.ok(deploy.indexOf('vps_receipts_apply') < deploy.indexOf('node scripts/release-checks.mjs'));
  assert.match(readFileSync('scripts/lib/deploy-vps.sh', 'utf8'), /DEPLOY_VPS_RECEIPTS:-\}" == on/);
});

test('rows 2, 44, 45 and 52 (browser launched through an import, or webkit.launch + clock.resume) are not trusted; a missing script is not trusted', () => {
  const byName = (name: string) => commands.findIndex(c => c.join(' ').includes(name)) + 1;
  const trusted: number[] = trustedFromVps(receipt(), tree, commands, source, sums, JOBS, TREES);
  for (const name of ['roster-browser-check', 'double-tap-browser-check', 'sparring-browser-check', 'next-fight-black-check']) {
    const index = byName(name);
    assert.ok(index > 0, `${name} is a release row`);
    assert.ok(!trusted.includes(index), `${name} (row ${index}) must stay off the VPS trust list`);
  }
  assert.equal(vpsSafeRow('node scripts/nope.mjs', ['node', 'scripts/nope.mjs'], source), false);
});

test('a receipt is refused unless its HF job verifies (completed, allowed flavor, the run sha, the canonical command) and its runner checksums match the deploy tree', () => {
  for (const bad of [{ scripts: undefined }, { scripts: { ...sums, 'rows-lib.mjs': 'x'.repeat(64) } }, { job: 'J2' }, { job: undefined }, { sha: 'f'.repeat(40) }]) {
    assert.deepEqual(trustedFromVps(receipt(bad), tree, commands, source, sums, JOBS, TREES), [], JSON.stringify(bad).slice(0, 60));
  }
  assert.deepEqual(trustedFromVps(receipt(), tree, commands, source, undefined, JOBS, TREES), [], 'no own checksums to compare = not trusted');
  assert.deepEqual(trustedFromVps(receipt(), tree, commands, source, sums, {}), [], 'no job record = not trusted');
  assert.deepEqual(trustedFromVps(receipt({ flavor: 't4-medium' }), tree, commands, source, sums, jobs('a10g-small'), TREES), [], 'a self-declared flavor is ignored; the refused GPU job is not trusted');
  assert.deepEqual(trustedFromVps(receipt({ flavor: 't4-medium' }), tree, commands, source, sums, jobs('vps-cpu'), TREES), [], 'the VPS is not a receipt source');
  assert.deepEqual(trustedFromVps(receipt(), tree, commands, source, sums, jobs('cpu-upgrade', { status: { stage: 'RUNNING' } }), TREES), [], 'only a COMPLETED job');
  assert.deepEqual(trustedFromVps(receipt(), tree, commands, source, sums, jobs('cpu-upgrade', { environment: { SHA: 'f'.repeat(40) } }), TREES), [], 'the job env SHA must be the run sha');
  assert.deepEqual(trustedFromVps(receipt(), tree, commands, source, sums, jobs('cpu-upgrade', { command: ['bash', '-c', `echo SHA=${sha}; exit 0`] }), TREES), [], 'a job running some other script is not a receipt');
  assert.deepEqual(trustedFromVps(receipt(), tree, commands, source, sums, jobs('cpu-upgrade', {}, 'unit'), TREES), [], 'the unit job command is not a rows job command');
  // Only the INSPECTED t4-medium may cover wall-clock rows, never WebKit; the cpu flavor never covers wall rows.
  const cpu: number[] = trustedFromVps(receipt(), tree, commands, source, sums, jobs('cpu-upgrade'), TREES);
  const t4: number[] = trustedFromVps(receipt(), tree, commands, source, sums, jobs('t4-medium'), TREES);
  assert.ok(t4.length > cpu.length && cpu.every(i => t4.includes(i)));
  for (const name of ['double-tap-browser-check', 'next-fight-black-check']) assert.ok(!t4.includes(commands.findIndex((c: string[]) => c.join(' ').includes(name)) + 1), `${name}: WebKit stays on the Mac`);
});

test('the receipt sha is bound to the deploy tree: a completed canonical job on an OLDER sha with a forged receipt.tree is refused (rows and unit)', () => {
  const old = 'a1'.repeat(20), oldTree = 'b2'.repeat(20);
  const forged = receipt({ sha: old, tree });   // claims the deploy tree, but the commit it ran has another one
  const J = { J1: { ...jobs('cpu-upgrade', { environment: { SHA: old }, command: jobCommand('rows', old) }).J1 } };
  assert.deepEqual(trustedFromVps(forged, tree, commands, source, sums, J, { [old]: oldTree }), []);
  assert.deepEqual(trustedFromVps(forged, tree, commands, source, sums, J, {}), [], 'unknown commit = fail closed');
  assert.ok(trustedFromVps(forged, tree, commands, source, sums, J, { [old]: tree }).length > 0, 'a candidate commit with the same tree is fine');
  const U = { J1: { ...jobs('cpu-upgrade', { environment: { SHA: old }, command: jobCommand('unit', old) }).J1 } };
  const unit = { kind: 'vps-unit-suite', job: 'J1', sha: old, tree, node: 'v24', pass: 5, fail: 0, exit: 0, scripts: { 'run-unit.sh': 'u'.repeat(64) } };
  assert.equal(unitReceiptOk(unit, tree, { 'run-unit.sh': 'u'.repeat(64) }, U, { [old]: oldTree }), false);
  assert.equal(unitReceiptOk(unit, tree, { 'run-unit.sh': 'u'.repeat(64) }, U, { [old]: tree }), true);
});

test('a row a shard SKIPPED or never reached does not veto it; a fail or ceiling does', () => {
  const base: number[] = trustedFromVps(receipt(), tree, commands, source, sums, JOBS, TREES);
  const skipped = receipt({ rows: rows.map((r: Row) => ({ ...r, status: r.index === base[0] ? 'trusted' : 'pass', exit: r.index === base[0] ? undefined : 0 })) });
  assert.ok(trustedFromShards([receipt(), skipped], tree, commands, source, sums, JOBS, TREES).includes(base[0]), 'shard B skipped it, shard A passed it');
  const ceiling = receipt({ rows: rows.filter((r: Row) => r.index === base[0]).map((r: Row) => ({ ...r, status: 'ceiling' })) });
  assert.ok(!trustedFromShards([receipt(), ceiling], tree, commands, source, sums, JOBS, TREES).includes(base[0]));
});

test('a string or missing row index can neither be trusted nor dodge a FAIL veto', () => {
  const base: number[] = trustedFromVps(receipt(), tree, commands, source, sums, JOBS, TREES);
  const str = receipt({ rows: rows.map((r: Row) => ({ ...r, status: 'pass', exit: 0, index: String(r.index) })) });
  assert.deepEqual(trustedFromVps(str, tree, commands, source, sums, JOBS, TREES), []);
  const sneaky = receipt({ rows: [{ index: String(base[0]), command: 'x', status: 'fail', exit: 1 }] });
  assert.ok(!trustedFromShards([receipt(), sneaky], tree, commands, source, sums, JOBS, TREES).length, 'a malformed row in a receipt for the tree poisons the shard union (fail closed)');
});

test('strict row parse: only status pass AND exit exactly 0 counts (missing, null, -1, 1 never pass)', () => {
  const base: number[] = trustedFromVps(receipt(), tree, commands, source, sums, JOBS, TREES);
  const target = base[0];
  for (const exit of [undefined, null, -1, 1, '0']) {
    const r = receipt({ rows: rows.map((row: Row) => ({ ...row, status: 'pass', exit: row.index === target ? exit : 0 })) });
    assert.ok(!trustedFromVps(r, tree, commands, source, sums, JOBS, TREES).includes(target), `exit ${String(exit)}`);
  }
});

test('a FAIL for a row in ANY receipt for the tree vetoes it, even when another shard passed it', () => {
  const base: number[] = trustedFromVps(receipt(), tree, commands, source, sums, JOBS, TREES);
  const failing = receipt({ rows: rows.filter((r: Row) => r.index === base[0]).map((r: Row) => ({ ...r, status: 'fail', exit: 1 })) });
  const merged: number[] = trustedFromShards([receipt(), failing], tree, commands, source, sums, JOBS, TREES);
  assert.ok(!merged.includes(base[0]) && merged.length === base.length - 1);
  assert.deepEqual(trustedFromShards([failing, receipt()], tree, commands, source, sums, JOBS, TREES), merged, 'order does not matter');
});

test('N shard receipts for one tree: each row once, a shard of another tree adds nothing', () => {
  const all: number[] = trustedFromVps(receipt(), tree, commands, source, sums, JOBS, TREES);
  const half = (keep: (i: number) => boolean) => receipt({ rows: rows.filter((r: Row) => keep(r.index)).map((r: Row) => ({ ...r, status: 'pass', exit: 0 })) });
  const merged: number[] = trustedFromShards([half(i => i % 2 === 0), half(i => i % 2 === 1), half(() => true)], tree, commands, source, sums, JOBS, TREES);
  assert.deepEqual(merged, all);
  assert.deepEqual(trustedFromShards([receipt({ tree: 'c'.repeat(40) })], tree, commands, source, sums, JOBS, TREES), []);
});

test('the unit-suite receipt needs this tree, zero failures, an integer pass count, a verified unit job and a matching run-unit.sh checksum', () => {
  const unit = (over = {}) => ({ kind: 'vps-unit-suite', job: 'J1', sha, tree, node: 'v24', pass: 2961, fail: 0, exit: 0, scripts: { 'run-unit.sh': 'u'.repeat(64) }, ...over });
  const own = { 'run-unit.sh': 'u'.repeat(64) }, J = jobs('cpu-upgrade', {}, 'unit');
  assert.equal(unitReceiptOk(unit(), tree, own, J, TREES), true);
  for (const bad of [{ tree: 'd'.repeat(40) }, { fail: 1 }, { exit: 1 }, { pass: 0 }, { pass: 1.5 }, { pass: '2961' }, { pass: null }, { job: 'J2' }, { job: undefined }, { sha: 'f'.repeat(40) }, { scripts: { 'run-unit.sh': 'z'.repeat(64) } }, { kind: 'vps-shadow-rows' }]) {
    assert.equal(unitReceiptOk(unit(bad), tree, own, J, TREES), false, JSON.stringify(bad));
  }
  assert.equal(unitReceiptOk(null, tree, own, J, TREES), false);
  assert.equal(unitReceiptOk(unit(), tree, {}, J, TREES), false);
  assert.equal(unitReceiptOk(unit(), tree, own, {}, TREES), false, 'no job record');
  assert.equal(unitReceiptOk(unit(), tree, own, jobs('a10g-small', {}, 'unit'), TREES), false, 'refused flavor');
  assert.equal(unitReceiptOk(unit(), tree, own, jobs('cpu-upgrade', {}, 'rows'), TREES), false, 'the rows job command is not the unit job command');
  assert.equal(unitReceiptOk(unit(), tree, own, jobs('cpu-upgrade', { command: ['bash', '-c', 'exit 0'] }, 'unit'), TREES), false, 'another script under the same SHA');
});

test('deploy.sh takes the unit-suite receipt branch before the CI/Mac gates, and the producers name the job id + checksums', () => {
  const deploy = readFileSync('scripts/deploy.sh', 'utf8');
  assert.ok(deploy.indexOf('vps_unit_receipt_ok') < deploy.indexOf('quality_green "$revision"') + 5000 && deploy.indexOf('vps_unit=') < deploy.indexOf('npm run quality\n'));
  assert.match(readFileSync('scripts/vps-shadow/rows-json.mjs', 'utf8'), /job: process\.env\.JOB_ID/);
  assert.match(readFileSync('scripts/vps-shadow/run-unit.sh', 'utf8'), /"run-unit\.sh": c\.createHash/);
});

test('vps-receipt-trust.mjs trusts nothing when git cannot resolve the sha (non-zero status), and prints no rows', () => {
  const r = spawnSync('node', ['scripts/vps-receipt-trust.mjs', 'no-such-ref-zzzz'], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /trusting nothing/);
});

test('launch.mjs launches exactly the canonical job (detached, timed, allowed flavors, SHA env) and reads the RECEIPT line back', () => {
  const unit = hfArgs('unit', sha), rowsJob = hfArgs('rows', sha, 't4-medium');
  assert.deepEqual(unit.slice(0, 9), ['jobs', 'run', '--flavor', 'cpu-upgrade', '--timeout', '40m', '--detach', '-e', `SHA=${sha}`]);
  assert.deepEqual(unit.slice(9), ['node:22', ...jobCommand('unit', sha)]);
  assert.deepEqual(rowsJob.slice(2, 7), ['--flavor', 't4-medium', '--timeout', '20m', '--detach']);
  for (const bad of [['unit', sha, 'a10g-small'], ['unit', sha, 'vps-cpu'], ['unit', 'short'], ['bogus', sha]]) assert.throws(() => hfArgs(...(bad as [string, string, string])), bad.join(' '));
  assert.deepEqual(receiptFrom('x\nRECEIPT unit {"job":"J1","pass":3}\nbye', 'unit'), { job: 'J1', pass: 3 });
  assert.equal(receiptFrom('RECEIPT rows {bad json', 'rows'), null);
  assert.equal(receiptFrom('RECEIPT rows {"a":1}', 'unit'), null, 'the kind must match');
  assert.deepEqual(hfArgs('rows', sha, 'cpu-upgrade', '31,33').slice(7, 11), ['-e', `SHA=${sha}`, '-e', 'ROWS_ONLY=31,33']);
  assert.throws(() => hfArgs('unit', sha, 'cpu-upgrade', '31'));
  assert.throws(() => hfArgs('rows', sha, 'cpu-upgrade', '31;rm'));
  assert.match(readFileSync('scripts/vps-shadow/run-rows.sh', 'utf8'), /playwright install --with-deps chromium/);
  assert.match(jobCommand('rows', sha)[2], /libjpeg-turbo-progs/);
  for (const f of ['run-unit.sh', 'run-rows.sh']) assert.match(readFileSync(`scripts/vps-shadow/${f}`, 'utf8'), /echo "RECEIPT (unit|rows) /);
});

test('deploy-vps.sh reads the HF receipts back with launch.mjs fetch BEFORE vps-receipt-trust.mjs, in both the rows and the unit step, and no longer pulls from the shared VPS dir', () => {
  const lib = readFileSync('scripts/lib/deploy-vps.sh', 'utf8').replace(/^\s*#.*$/gm, '');   // comments do not count
  const fetches = [...lib.matchAll(/launch\.mjs fetch/g)].map(m => m.index as number), trusts = [...lib.matchAll(/vps-receipt-trust\.mjs/g)].map(m => m.index as number);
  assert.equal(fetches.length, 2);
  assert.equal(trusts.length, 2);
  fetches.forEach((at, i) => assert.ok(at < trusts[i], `step ${i + 1}: fetch before trust`));
  assert.ok(!/vps-shadow-rows\.sh/.test(lib), 'the old ssh fetch is gone');
  assert.match(lib, /DEPLOY_VPS_RECEIPTS:-\}" == on/);
});
