// Behaviour tests for the VPS receipt path (Auditor mediums M2-M4 on #1916): the shell steps run for real in a scratch directory with
// stubbed ssh/rsync and stubbed producers, and the shard guards are each tried with a receipt that must add nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { trustedFromShards, trustedFromVps } from '../scripts/lib/vps-receipts.mjs';
import { rowSet } from '../scripts/vps-shadow/rows-lib.mjs';

const commands: string[][] = JSON.parse(readFileSync('.quality-gate.json', 'utf8')).release_commands;
const source = (script: string) => { try { return readFileSync(script, 'utf8'); } catch { return null; } };
const tree = 'a'.repeat(40), sha = 'b'.repeat(40);
type Row = { index: number; command: string };
const rows: Row[] = rowSet(commands, source);
const sums = { 'run-rows.sh': 'r'.repeat(64), 'rows-json.mjs': 'j'.repeat(64), 'rows-lib.mjs': 'l'.repeat(64) };
const receipt = (over = {}) => ({ kind: 'vps-shadow-rows', flavor: 'vps-cpu', scripts: sums, tree, buildStatus: 0, dirty: 0, rows: rows.map(r => ({ ...r, status: 'pass' })), ...over });
const exe = (file: string, text: string) => { writeFileSync(file, text); chmodSync(file, 0o755); };
const scratch = () => { const dir = mkdtempSync(join(tmpdir(), 'vps-receipts-')); mkdirSync(join(dir, 'scripts/lib'), { recursive: true }); mkdirSync(join(dir, 'bin')); return dir; };

test('--fetch of a unit-only sha brings back unit.json and exits 0 (no runs/<sha>/latest/ on the box)', () => {
  const dir = scratch();
  try {
    copyFileSync('scripts/vps-shadow-rows.sh', join(dir, 'scripts/vps-shadow-rows.sh'));
    writeFileSync(join(dir, 'unit.json'), '{"kind":"vps-unit-suite"}\n');
    // rsync stub: the rows copy (…/latest/) fails as it does when no row run exists; the unit.json copy succeeds.
    exe(join(dir, 'bin/rsync'), `#!/usr/bin/env bash\nfor a; do last="$a"; done\ncase "$*" in *latest/*) exit 23;; *unit.json*) cp "${dir}/unit.json" "$last";; esac\n`);
    exe(join(dir, 'bin/ssh'), '#!/usr/bin/env bash\nexit 0\n');
    const r = spawnSync('bash', [join(dir, 'scripts/vps-shadow-rows.sh'), sha, '--fetch'], { encoding: 'utf8', timeout: 30_000, env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}` } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(existsSync(join(dir, `artifacts/vps-shadow/${sha}/unit.json`)), 'unit.json was not fetched');
    assert.match(r.stdout, /no row run/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Runs one deploy-vps.sh step in a scratch checkout whose producers are stubs: the fetch succeeds and the trust CLI prints `trust`.
const step = (call: string, trust: string, on: boolean) => {
  const dir = scratch();
  try {
    copyFileSync('scripts/lib/deploy-vps.sh', join(dir, 'scripts/lib/deploy-vps.sh'));
    exe(join(dir, 'scripts/vps-shadow-rows.sh'), '#!/usr/bin/env bash\nexit 0\n');
    writeFileSync(join(dir, 'scripts/vps-receipt-trust.mjs'), `process.stdout.write(${JSON.stringify(trust)});\n`);
    const script = `set -euo pipefail\nsource scripts/lib/deploy-vps.sh\nrevision=${sha}\ntrusted_checks=1,5\ntrust_source=CI\n${call}\necho "trusted=$trusted_checks source=$trust_source"\n`;
    const r = spawnSync('bash', ['-c', script], { cwd: dir, encoding: 'utf8', timeout: 30_000, env: { ...process.env, DEPLOY_VPS_RECEIPTS: on ? 'on' : '' } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    return r.stdout;
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('vps_receipts_apply joins the VPS rows to the trusted list (deduplicated) when on, and changes nothing when off', () => {
  assert.match(step('vps_receipts_apply', '5,7', true), /trusted=1,5,7 source=CI \+ VPS receipts \(rows 5,7; tree-bound\)/);
  assert.match(step('vps_receipts_apply', '5,7', false), /trusted=1,5 source=CI$/m);
  assert.match(step('vps_receipts_apply', '', true), /trusted=1,5 source=CI$/m);
});

test('vps_unit_receipt_ok prints ok only when on and the trust CLI vouches for the tree', () => {
  assert.match(step('v=$(vps_unit_receipt_ok); echo "unit=[$v]"', 'ok', true), /unit=\[ok\]/);
  assert.match(step('v=$(vps_unit_receipt_ok); echo "unit=[$v]"', 'ok', false), /unit=\[\]/);
  assert.match(step('v=$(vps_unit_receipt_ok); echo "unit=[$v]"', '', true), /unit=\[\]/);
});

test('deploy.sh calls both steps, before the gate and the rows they replace (each call found, no slack)', () => {
  const lines = readFileSync('scripts/deploy.sh', 'utf8').split('\n');
  const at = (re: RegExp) => { const i = lines.findIndex(line => re.test(line)); assert.ok(i >= 0, `deploy.sh: no line matching ${re}`); return i; };
  assert.ok(at(/^vps_unit=\$\(vps_unit_receipt_ok\)/) < at(/^if \[\[ "\$vps_unit" == ok \]\]/));
  assert.ok(at(/^if \[\[ "\$vps_unit" == ok \]\]/) < at(/^\s+npm run quality$/));
  assert.ok(at(/^vps_receipts_apply\b/) < at(/^\s*(?:[A-Z_]+=\S*\s+)*node scripts\/release-checks\.mjs/));
  assert.ok(at(/^trusted_checks=/) < at(/^vps_receipts_apply\b/));
});

test('rows are combined across shards when no single shard holds them all', () => {
  const pass = rows.map(r => ({ ...r, status: 'pass' }));
  const all: number[] = trustedFromVps(receipt(), tree, commands, source, sums);
  assert.ok(all.length >= 2);
  const shards = [0, 1, 2].map(k => receipt({ rows: pass.filter((_, i) => i % 3 === k) }));
  for (const shard of shards) assert.ok(trustedFromVps(shard, tree, commands, source, sums).length < all.length);
  assert.deepEqual(trustedFromShards(shards, tree, commands, source, sums), all);
});

test('each shard is judged on its own: a bad shard (tree, flavor, runner sums, build, dirty) adds nothing and takes nothing from a good one', () => {
  const pass = rows.map(r => ({ ...r, status: 'pass' }));
  const good = receipt({ rows: pass.filter((_, i) => i % 2 === 0) }), rest = pass.filter((_, i) => i % 2 === 1);
  const goodOnly: number[] = trustedFromShards([good], tree, commands, source, sums);
  for (const bad of [{ tree: 'c'.repeat(40) }, { flavor: 'a10g-small' }, { flavor: undefined }, { scripts: { ...sums, 'rows-lib.mjs': 'x'.repeat(64) } }, { buildStatus: 1 }, { dirty: 1 }]) {
    assert.deepEqual(trustedFromShards([good, receipt({ ...bad, rows: rest })], tree, commands, source, sums), goodOnly, JSON.stringify(bad));
    assert.deepEqual(trustedFromShards([receipt({ ...bad, rows: rest }), good], tree, commands, source, sums), goodOnly, JSON.stringify(bad));
  }
});

test('vps-receipt-trust.mjs hashes all three runner files: a shard naming another rows-lib.mjs (or run-rows.sh, rows-json.mjs) trusts nothing', () => {
  const head = spawnSync('git', ['rev-parse', 'HEAD', 'HEAD^{tree}'], { encoding: 'utf8', timeout: 10_000 }).stdout.trim().split('\n');
  const own = (f: string) => spawnSync('shasum', ['-a', '256', `scripts/vps-shadow/${f}`], { encoding: 'utf8', timeout: 10_000 }).stdout.slice(0, 64);
  const real = { 'run-rows.sh': own('run-rows.sh'), 'rows-json.mjs': own('rows-json.mjs'), 'rows-lib.mjs': own('rows-lib.mjs') };
  const dir = `artifacts/vps-shadow/${head[0]}`;
  const run = (scripts: object) => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'rows-guard-test.json'), JSON.stringify(receipt({ tree: head[1], scripts })));
    try { return spawnSync('node', ['scripts/vps-receipt-trust.mjs', head[0]], { encoding: 'utf8', timeout: 30_000 }).stdout; }
    finally { rmSync(join(dir, 'rows-guard-test.json'), { force: true }); }
  };
  try {
    assert.notEqual(run(real), '', 'the real runner sums must trust the safe rows');
    for (const name of Object.keys(real)) assert.equal(run({ ...real, [name]: '0'.repeat(64) }), '', `${name} is not checked`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
