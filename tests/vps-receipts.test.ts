import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { NEVER_ON_HF, SLOW_ROWS, coverageGaps, jobCommand, jobEnvOk, trustedFromVps, trustedFromShards, unitReceiptOk, vpsSafeRow } from '../scripts/lib/vps-receipts.mjs';
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
const jobs = (flavor = 'cpu-upgrade', over = {}, kind = 'rows') => ({ J1: { id: 'J1', flavor, status: { stage: 'COMPLETED' }, docker_image: 'node:22', arguments: [], owner: { name: 'Domlynch' }, space_id: null, secrets: [], environment: { SHA: sha }, command: jobCommand(kind, sha), ...over } });
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

test('the VPS receipt steps are opt-in (their order in deploy.sh and their behaviour: tests/vps-receipts-guards.test.ts)', () => {
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
  assert.ok(!trustedFromShards([receipt(), sneaky], tree, commands, source, sums, JOBS, TREES).includes(base[0]), 'a FAIL under a string index still vetoes that row');
});

test('the job environment is a closed set with strict values, and no secrets: an injected NODE_OPTIONS/BASH_ENV/npm_config_* job is refused', () => {
  const ok = (env: Record<string, string | undefined>, extra = {}) => trustedFromVps(receipt(), tree, commands, source, sums, jobs('cpu-upgrade', { environment: env, ...extra }), TREES).length > 0;
  assert.equal(ok({ SHA: sha }), true);
  assert.equal(ok({ SHA: sha, ROWS_ONLY: '31,33', RELEASE_CHECK_CONCURRENCY: '2' }), true, 'the allowed set is accepted');
  for (const bad of [{ NODE_OPTIONS: '--require /x.js' }, { BASH_ENV: '/x' }, { npm_config_script_shell: '/x' }, { ROWS_ONLY: '31;rm' }, { ROWS_ONLY: '' }, { RELEASE_CHECK_CONCURRENCY: '9' }, { RELEASE_CHECK_CONCURRENCY: '2 ' }]) assert.equal(ok({ SHA: sha, ...bad }), false, JSON.stringify(bad));
  assert.equal(ok({}), false, 'no SHA');
  assert.equal(ok({ SHA: sha }, { secrets: { HF_TOKEN: 'x' } }), false, 'a job with secrets');
  assert.equal(ok({ SHA: sha }, { secrets: [] }), true);
  assert.equal(ok({ SHA: sha }, { secrets: undefined }), false, 'secrets absent = refused (a real inspect always has the empty array)');
  for (const key of ['LD_PRELOAD', 'NODE_OPTIONS', 'BASH_ENV']) assert.equal(ok({ SHA: sha, [key]: '/x' }), false, key);
  assert.equal(ok({ sha }), false, 'a lowercase sha key is not SHA');
  assert.equal(ok({ SHA: sha, sha }), false, 'an extra lowercase sha key');
  assert.equal(ok({ SHA: sha }, { docker_image: 'node:22.1' }), false, 'another image');
  assert.equal(ok({ SHA: sha }, { docker_image: 'evil/node:22' }), false);
  assert.equal(ok({ SHA: sha }, { arguments: ['--x'] }), false, 'job arguments');
  assert.equal(ok({ SHA: sha }, { arguments: undefined }), true, 'arguments absent is fine');
  assert.equal(ok({ SHA: sha }, { owner: { name: 'domlynch' } }), false, 'another account (case matters)');
  assert.equal(ok({ SHA: sha }, { owner: undefined }), false);
  assert.equal(ok({ SHA: sha }, { space_id: 'x/y' }), false, 'a Space job');
  const U = (env: Record<string, string | undefined>) => unitReceiptOk({ kind: 'vps-unit-suite', job: 'J1', sha, tree, pass: 5, fail: 0, exit: 0, scripts: { 'run-unit.sh': 'u'.repeat(64) } }, tree, { 'run-unit.sh': 'u'.repeat(64) }, jobs('cpu-upgrade', { environment: env }, 'unit'), TREES);
  assert.equal(U({ SHA: sha }), true);
  assert.equal(U({ SHA: sha, ROWS_ONLY: '31' }), false, 'unit allows SHA only');
  assert.equal(U({ SHA: sha, NODE_OPTIONS: '--require /x.js' }), false);
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

test('the producers name the job id + checksums (the unit branch order in deploy.sh: tests/vps-receipts-guards.test.ts)', () => {
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
  assert.deepEqual(hfArgs('rows', sha, 'cpu-upgrade', '31,33', '2').slice(7, 13), ['-e', `SHA=${sha}`, '-e', 'ROWS_ONLY=31,33', '-e', 'RELEASE_CHECK_CONCURRENCY=2']);
  assert.throws(() => hfArgs('rows', sha, 'cpu-upgrade', '31', '9'));
  assert.throws(() => hfArgs('unit', sha, 'cpu-upgrade', '', '2'));
  assert.throws(() => hfArgs('unit', sha, 'cpu-upgrade', '31'));
  assert.throws(() => hfArgs('rows', sha, 'cpu-upgrade', '31;rm'));
  assert.match(readFileSync('scripts/vps-shadow/run-rows.sh', 'utf8'), /playwright install --with-deps chromium/);
  assert.match(readFileSync('scripts/vps-shadow/run-rows.sh', 'utf8').trimEnd(), /RECEIPT rows[\s\S]*\nexit 0$/, 'the rows job ends COMPLETED once the receipt is printed; a failing row is in the receipt, not in the job state');
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

test('launch.mjs runs a slow row alone: one row per job, width 1, cpu-upgrade, ceiling 1500 s and a 35m job timeout; it refuses them in a shared shard or on t4-medium', () => {
  assert.deepEqual(SLOW_ROWS, [5, 7, 9, 13, 16, 21, 28, 34, 36]);
  for (const row of SLOW_ROWS) {
    const args = hfArgs('rows', sha, 'cpu-upgrade', String(row), '1');
    assert.ok(args.includes('RELEASE_CHECK_CEILING_S=1500') && args.includes('35m') && args.includes(`ROWS_ONLY=${row}`), `row ${row}`);
    assert.throws(() => hfArgs('rows', sha, 'cpu-upgrade', `30,${row}`, '1'), /one row per job/, `row ${row} shared`);
    assert.throws(() => hfArgs('rows', sha, 'cpu-upgrade', String(row), '4'), /one row per job/, `row ${row} wide`);
    assert.throws(() => hfArgs('rows', sha, 'cpu-upgrade', String(row)), /one row per job/, `row ${row} no width`);
  }
  assert.throws(() => hfArgs('rows', sha, 't4-medium', '5', '1'), /one row per job/, 't4-medium does not rescue them either');
  const plain = hfArgs('rows', sha, 'cpu-upgrade', '30,31,33');
  assert.ok(plain.includes('ROWS_ONLY=30,31,33') && plain.includes('20m') && !plain.some(a => String(a).startsWith('RELEASE_CHECK_CEILING_S')), 'other rows keep the 20m job and the default ceiling');
  assert.equal(hfArgs('rows', sha).includes('node:22'), true, 'the image is JOB_IMAGE');
});

test('the verifier accepts a slow-row job env (RELEASE_CHECK_CEILING_S 100-9999 digits only) and refuses a free-form one', () => {
  assert.equal(jobEnvOk({ SHA: sha, ROWS_ONLY: '5', RELEASE_CHECK_CONCURRENCY: '1', RELEASE_CHECK_CEILING_S: '1500' }, sha, 'rows'), true);
  assert.equal(jobEnvOk({ SHA: sha, RELEASE_CHECK_CEILING_S: '1500;x' }, sha, 'rows'), false);
  assert.equal(jobEnvOk({ SHA: sha, RELEASE_CHECK_CEILING_S: '1500' }, sha, 'unit'), false);
});

test('the runners show their evidence in the job log: rows tee the per-row lines (keeping the release-checks exit code), the unit runner prints the failing tests', () => {
  const rowsSh = readFileSync('scripts/vps-shadow/run-rows.sh', 'utf8'), unitSh = readFileSync('scripts/vps-shadow/run-unit.sh', 'utf8');
  assert.match(rowsSh, /release-checks\.mjs 2>&1 \| tee "\$run\/rows\.log"; rows_status=\$\{PIPESTATUS\[0\]\}/);
  assert.match(unitSh, /grep -E '\^not ok' "\$run\/unit\.log" \| grep -v '# TODO' \| head -20/);
});

test('coverage: a shardable row no shard ran is UNASSIGNED; WebKit and real-clock rows are Mac-only and never unassigned (Release G left 15 behind)', () => {
  const full = coverageGaps([receipt()], commands, source);
  assert.deepEqual(full.unassigned, []);
  assert.ok(full.macOnly.length > 0 && full.macOnly.every((i: number) => !full.t4Only.includes(i)));
  const skipped = receipt({ rows: rows.map((r: Row) => ({ ...r, status: r.index === 2 ? 'trusted' : 'pass', exit: 0 })) });
  assert.deepEqual(coverageGaps([skipped], commands, source).unassigned, full.macOnly.includes(2) ? [] : [2]);
  assert.equal(coverageGaps([], commands, source).unassigned.length, commands.length - full.macOnly.length - full.slow.length);
});

test('the launch waits for a RUNNING shard job and refuses unassigned rows', () => {
  const lib = readFileSync('scripts/lib/deploy-vps.sh', 'utf8');
  assert.match(lib, /RUNNING\|STARTING\|PENDING\|SCHEDULING/);
  assert.match(lib, /grep -q 'UNASSIGNED rows'/);
  assert.match(lib, /DEPLOY_ALLOW_UNASSIGNED/);
});

test('coverage: SLOW_ROWS are never shardable, so they are never UNASSIGNED (#1933 refuses to shard them; Release H would exit 1 otherwise)', () => {
  const none = coverageGaps([], commands, source);
  for (const row of SLOW_ROWS) assert.ok(!none.unassigned.includes(row), `row ${row}`);
  assert.deepEqual(none.slow, SLOW_ROWS.filter((i: number) => !none.macOnly.includes(i)));
  assert.equal(none.unassigned.length + none.macOnly.length + none.slow.length, commands.length);
});

test('rows that never passed on a Hugging Face job (roster 600 s ceiling, sparring exit 1) are Mac-only on every flavor and never UNASSIGNED', () => {
  assert.deepEqual(NEVER_ON_HF, ['roster-browser-check.mjs', 'sparring-browser-check.mjs', 'account-database-check.mjs']);
  const source = () => 'export const x = 1;';
  for (const name of NEVER_ON_HF) for (const wall of [false, true]) assert.equal(vpsSafeRow(`node scripts/${name}`, ['node', `scripts/${name}`], source, wall), false);
  assert.equal(vpsSafeRow('node scripts/other-check.mjs', ['node', 'scripts/other-check.mjs'], source, true), true);
  const commands = [['node', 'scripts/roster-browser-check.mjs'], ['node', 'scripts/other-check.mjs']];
  const gaps = coverageGaps([], commands, source);
  assert.deepEqual(gaps.macOnly, [1]);
  assert.deepEqual(gaps.unassigned, [2]);
});

test('run-rows.sh prints the last 50 lines of every FAILED or CEILING row into the job log', () => {
  const run = readFileSync('scripts/vps-shadow/run-rows.sh', 'utf8');
  assert.match(run, /grep -E 'FAILED\|CEILING' "\$run\/rows\.log"/);
  assert.match(run, /tail -n 50 "\$f"/);
});
