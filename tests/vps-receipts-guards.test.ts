// Behaviour tests for the HF receipt path (Auditor mediums M2-M4 on #1916): the deploy-vps.sh steps run for real under `set -euo pipefail` in a
// scratch directory with stubbed producers (launch.mjs fetch, vps-receipt-trust.mjs, hf), and the shard guards are each tried with a receipt that
// must add nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { JOB_IMAGE, JOB_OWNER, jobCommand, trustedFromShards, trustedFromVps } from '../scripts/lib/vps-receipts.mjs';
import { rowSet } from '../scripts/vps-shadow/rows-lib.mjs';

const commands: string[][] = JSON.parse(readFileSync('.quality-gate.json', 'utf8')).release_commands;
const source = (script: string) => { try { return readFileSync(script, 'utf8'); } catch { return null; } };
const tree = 'a'.repeat(40), sha = 'b'.repeat(40);
type Row = { index: number; command: string };
const rows: Row[] = rowSet(commands, source);
const pass = rows.map(r => ({ ...r, status: 'pass', exit: 0 }));
const sums = { 'run-rows.sh': 'r'.repeat(64), 'rows-json.mjs': 'j'.repeat(64), 'rows-lib.mjs': 'l'.repeat(64) };
const receipt = (over = {}) => ({ kind: 'vps-shadow-rows', job: 'J1', sha, scripts: sums, tree, buildStatus: 0, dirty: 0, rows: pass, ...over });
// What `hf jobs inspect` reports for a canonical job: every field jobVerified pins (image, no arguments, owner, no Space, no secrets, env, command).
const pinned = { docker_image: JOB_IMAGE, arguments: [], secrets: [], owner: { name: JOB_OWNER }, space_id: null };
const job = (id: string, over = {}) => ({ id, flavor: 'cpu-upgrade', status: { stage: 'COMPLETED' }, ...pinned, environment: { SHA: sha }, command: jobCommand('rows', sha), ...over });
const JOBS = { J1: job('J1'), J2: job('J2') };
const TREES = { [sha]: tree };
const exe = (file: string, text: string) => { writeFileSync(file, text); chmodSync(file, 0o755); };

// One deploy-vps.sh step in a scratch checkout: `launch.mjs fetch` exits `fetchExit` (1 = the job printed no RECEIPT line) and the trust CLI prints `trust`.
const step = (call: string, { trust = '', fetchExit = 0, on = true, env = {} as Record<string, string> } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'vps-receipts-'));
  try {
    mkdirSync(join(dir, 'scripts/lib'), { recursive: true }); mkdirSync(join(dir, 'scripts/vps-shadow'));
    copyFileSync('scripts/lib/deploy-vps.sh', join(dir, 'scripts/lib/deploy-vps.sh'));
    writeFileSync(join(dir, 'scripts/vps-shadow/launch.mjs'), `process.exit(${fetchExit});\n`);
    writeFileSync(join(dir, 'scripts/vps-receipt-trust.mjs'), `process.stdout.write(${JSON.stringify(trust)});\n`);
    const script = `set -euo pipefail\nsource scripts/lib/deploy-vps.sh\nrevision=${sha}\ntrusted_checks=1,5\ntrust_source=CI\n${call}\necho "END trusted=$trusted_checks source=$trust_source"\n`;
    const r = spawnSync('bash', ['-c', script], { cwd: dir, encoding: 'utf8', timeout: 30_000, env: { ...process.env, DEPLOY_VPS_RECEIPTS: on ? 'on' : '', ...env } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /^END /m, 'the step must return to deploy.sh');
    return r.stdout;
  } finally { rmSync(dir, { recursive: true, force: true }); }
};
const unit = 'v=$(vps_unit_receipt_ok); echo "unit=[$v]"';

test('vps_receipts_apply joins the HF rows to the trusted list (deduplicated) when on; off or nothing trusted changes nothing', () => {
  assert.match(step('vps_receipts_apply', { trust: '5,7', env: { DEPLOY_HF_ROWS_JOBS: 'J1,J2' } }), /END trusted=1,5,7 source=CI \+ VPS receipts \(rows 5,7; tree-bound\)/);
  assert.match(step('vps_receipts_apply', { trust: '5,7', on: false, env: { DEPLOY_HF_ROWS_JOBS: 'J1' } }), /END trusted=1,5 source=CI$/m);
  assert.match(step('vps_receipts_apply', { trust: '', env: { DEPLOY_HF_ROWS_JOBS: 'J1' } }), /END trusted=1,5 source=CI$/m);
});

test('a failed fetch does not end deploy.sh under set -e: each job says so and its rows run on the Mac (rows and unit step)', () => {
  const out = step('vps_receipts_apply', { trust: '', fetchExit: 1, env: { DEPLOY_HF_ROWS_JOBS: 'J1,J2' } });
  assert.match(out, /no receipt from job J1/); assert.match(out, /no receipt from job J2/);
  assert.match(out, /END trusted=1,5 source=CI$/m);
  assert.match(step(unit, { trust: '', fetchExit: 1, env: { DEPLOY_HF_UNIT_JOB: 'J1' } }), /unit=\[\]/);
});

test('vps_unit_receipt_ok prints ok only when on, a unit job is named and the trust CLI vouches for the tree', () => {
  assert.match(step(unit, { trust: 'ok', env: { DEPLOY_HF_UNIT_JOB: 'J1' } }), /unit=\[ok\]/);
  assert.match(step(unit, { trust: 'ok', on: false, env: { DEPLOY_HF_UNIT_JOB: 'J1' } }), /unit=\[\]/);
  assert.match(step(unit, { trust: 'ok' }), /unit=\[\]/, 'no DEPLOY_HF_UNIT_JOB: the Mac runs its suite');
  assert.match(step(unit, { trust: '', env: { DEPLOY_HF_UNIT_JOB: 'J1' } }), /unit=\[\]/);
});

test('deploy.sh calls both steps, before the gate and the rows they replace (each call found as a statement, no slack)', () => {
  const lines = readFileSync('scripts/deploy.sh', 'utf8').split('\n');
  const at = (re: RegExp) => { const i = lines.findIndex(line => re.test(line)); assert.ok(i >= 0, `deploy.sh: no line matching ${re}`); return i; };
  assert.ok(at(/^vps_unit=\$\(vps_unit_receipt_ok\)/) < at(/^if \[\[ "\$vps_unit" == ok \]\]/));
  assert.ok(at(/^if \[\[ "\$vps_unit" == ok \]\]/) < at(/^\s+npm run quality$/));
  assert.ok(at(/^trusted_checks=/) < at(/^vps_receipts_apply\b/));
  assert.ok(at(/^vps_receipts_apply\b/) < at(/^\s*(?:[A-Z_]+=\S*\s+)*node scripts\/release-checks\.mjs/));
});

test('rows are combined across shards when no single shard holds them all', () => {
  const all: number[] = trustedFromVps(receipt(), tree, commands, source, sums, JOBS, TREES);
  assert.ok(all.length >= 3);
  const shards = [0, 1, 2].map(k => receipt({ rows: pass.filter((_, i) => i % 3 === k) }));
  for (const shard of shards) assert.ok(trustedFromVps(shard, tree, commands, source, sums, JOBS, TREES).length < all.length);
  assert.deepEqual(trustedFromShards(shards, tree, commands, source, sums, JOBS, TREES), all);
});

test('each shard is judged on its own: a bad shard adds nothing and takes nothing from a good one', () => {
  const good = receipt({ rows: pass.filter((_, i) => i % 2 === 0) }), rest = pass.filter((_, i) => i % 2 === 1);
  const goodOnly: number[] = trustedFromShards([good], tree, commands, source, sums, JOBS, TREES);
  assert.ok(goodOnly.length > 0);
  const bads: [string, object, object][] = [
    ['job unknown to the Hub', { job: 'J9' }, JOBS],
    ['job on a refused flavor', { job: 'J2' }, { ...JOBS, J2: job('J2', { flavor: 'a10g-small' }) }],
    ['job not completed', { job: 'J2' }, { ...JOBS, J2: job('J2', { status: { stage: 'ERROR' } }) }],
    ['job ran another command', { job: 'J2' }, { ...JOBS, J2: job('J2', { command: ['bash', '-c', 'exit 0'] }) }],
    ['commit of another tree', { sha: 'c'.repeat(40) }, { ...JOBS, J2: job('J2', { environment: { SHA: 'c'.repeat(40) } }) }],
    ['other runner sums', { scripts: { ...sums, 'rows-lib.mjs': 'x'.repeat(64) } }, JOBS],
    ['failed build', { buildStatus: 1 }, JOBS],
    ['dirty checkout', { dirty: 1 }, JOBS],
  ];
  for (const [why, over, jobs] of bads) {
    const bad = receipt({ ...over, rows: rest });
    assert.deepEqual(trustedFromShards([good, bad], tree, commands, source, sums, jobs, TREES), goodOnly, why);
    assert.deepEqual(trustedFromShards([bad, good], tree, commands, source, sums, jobs, TREES), goodOnly, `${why} (order)`);
  }
});

test('a FAIL vetoes only its own row (a string index is read as the number): every other row of the good shard survives', () => {
  const base: number[] = trustedFromVps(receipt(), tree, commands, source, sums, JOBS, TREES);
  for (const index of [base[0], String(base[0])]) {
    const sneaky = receipt({ job: 'J2', rows: [{ index, command: 'x', status: 'fail', exit: 1 }] });
    const want = base.slice(1);
    assert.deepEqual(trustedFromShards([receipt(), sneaky], tree, commands, source, sums, JOBS, TREES), want, `index ${JSON.stringify(index)}`);
    assert.deepEqual(trustedFromShards([sneaky, receipt()], tree, commands, source, sums, JOBS, TREES), want, `index ${JSON.stringify(index)} (order)`);
  }
});

test('vps-receipt-trust.mjs hashes all three runner files of the deploy commit: a shard naming another run-rows.sh, rows-json.mjs or rows-lib.mjs trusts nothing', () => {
  const [head, headTree] = spawnSync('git', ['rev-parse', 'HEAD', 'HEAD^{tree}'], { encoding: 'utf8', timeout: 10_000 }).stdout.trim().split('\n');
  const sum = (f: string) => spawnSync('git', ['show', `HEAD:scripts/vps-shadow/${f}`], { timeout: 10_000 }).stdout;
  const real: Record<string, string> = Object.fromEntries(['run-rows.sh', 'rows-json.mjs', 'rows-lib.mjs'].map(f => [f, createHash('sha256').update(sum(f)).digest('hex')]));
  // A dedicated receipt dir (VPS_RECEIPT_SHA names it), never artifacts/vps-shadow/<HEAD>: a deploy checkout's fetched receipts stay untouched (Auditor LOW).
  const name = `guard-test-${process.pid}`, bin = mkdtempSync(join(tmpdir(), 'vps-receipts-hf-')), dir = `artifacts/vps-shadow/${name}`;
  // hf stub: `hf jobs inspect J1` answers a completed canonical rows job for HEAD.
  exe(join(bin, 'hf'), `#!/usr/bin/env bash\necho '${JSON.stringify([{ id: 'J1', flavor: 'cpu-upgrade', status: { stage: 'COMPLETED' }, ...pinned, environment: { SHA: head }, command: jobCommand('rows', head) }])}'\n`);
  const run = (scripts: object) => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'rows-guard-test.json'), JSON.stringify(receipt({ sha: head, tree: headTree, scripts })));
    try { return spawnSync('node', ['scripts/vps-receipt-trust.mjs', head], { encoding: 'utf8', timeout: 30_000, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, VPS_RECEIPT_SHA: name } }).stdout; }
    finally { rmSync(join(dir, 'rows-guard-test.json'), { force: true }); }
  };
  try {
    assert.notEqual(run(real), '', 'the real runner sums must trust the safe rows');
    for (const name of Object.keys(real)) assert.equal(run({ ...real, [name]: '0'.repeat(64) }), '', `${name} is not checked`);
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(bin, { recursive: true, force: true }); }
});
