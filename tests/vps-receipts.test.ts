import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { trustedFromVps, trustedFromShards, unitReceiptOk, vpsSafeRow } from '../scripts/lib/vps-receipts.mjs';
import { rowSet } from '../scripts/vps-shadow/rows-lib.mjs';

const commands: string[][] = JSON.parse(readFileSync('.quality-gate.json', 'utf8')).release_commands;
const source = (script: string) => { try { return readFileSync(script, 'utf8'); } catch { return null; } };
const tree = 'a'.repeat(40);
type Row = { index: number; command: string; timing?: string };
const rows: Row[] = rowSet(commands, source);
const sums = { 'run-rows.sh': 'r'.repeat(64), 'rows-json.mjs': 'j'.repeat(64), 'rows-lib.mjs': 'l'.repeat(64) };
const receipt = (over = {}) => ({ kind: 'vps-shadow-rows', flavor: 'vps-cpu', scripts: sums, tree, buildStatus: 0, dirty: 0, rows: rows.map((r: Row) => ({ ...r, status: 'pass' })), ...over });

test('a VPS pass for the deployed tree is trusted for virtual-clock and no-browser rows only: never WebKit, never wall-clock', () => {
  const trusted: number[] = trustedFromVps(receipt(), tree, commands, source, sums);
  assert.ok(trusted.length > 0 && trusted.length < commands.length);
  // Stricter than the per-file label: the imports are read too, so a trusted row is never a wall or WebKit row by the plain label either.
  for (const row of rows) {
    const wallOrWebKit = row.timing === 'wall' || /--engine\s+webkit\b/.test(row.command);
    if (wallOrWebKit) assert.ok(!trusted.includes(row.index), `row ${row.index}`);
  }
});

test('nothing is trusted for another tree, a failed or dirty build, a failed row, or a row whose command changed', () => {
  assert.deepEqual(trustedFromVps(receipt(), 'b'.repeat(40), commands, source, sums), []);
  assert.deepEqual(trustedFromVps(receipt(), 'short', commands, source, sums), []);
  assert.deepEqual(trustedFromVps(receipt({ buildStatus: 1 }), tree, commands, source, sums), []);
  assert.deepEqual(trustedFromVps(receipt({ dirty: 2 }), tree, commands, source, sums), []);
  assert.deepEqual(trustedFromVps(null, tree, commands, source, sums), []);
  const base: number[] = trustedFromVps(receipt(), tree, commands, source, sums);
  const failed = receipt({ rows: rows.map((r: Row) => ({ ...r, status: r.index === base[0] ? 'fail' : 'pass', exit: r.index === base[0] ? 1 : undefined })) });
  assert.ok(!trustedFromVps(failed, tree, commands, source, sums).includes(base[0]));
  const edited = receipt({ rows: rows.map((r: Row) => ({ ...r, status: 'pass', command: r.index === base[0] ? `${r.command} --x` : r.command })) });
  assert.ok(!trustedFromVps(edited, tree, commands, source, sums).includes(base[0]));
});

test('deploy.sh applies the VPS receipts before the Mac rows, opt-in', () => {
  const deploy = readFileSync('scripts/deploy.sh', 'utf8');
  assert.ok(deploy.indexOf('vps_receipts_apply') < deploy.indexOf('node scripts/release-checks.mjs'));
  assert.match(readFileSync('scripts/lib/deploy-vps.sh', 'utf8'), /DEPLOY_VPS_RECEIPTS:-\}" == on/);
});

test('rows 2, 44, 45 and 52 (browser launched through an import, or webkit.launch + clock.resume) are not trusted; a missing script is not trusted', () => {
  const byName = (name: string) => commands.findIndex(c => c.join(' ').includes(name)) + 1;
  const trusted: number[] = trustedFromVps(receipt(), tree, commands, source, sums);
  for (const name of ['roster-browser-check', 'double-tap-browser-check', 'sparring-browser-check', 'next-fight-black-check']) {
    const index = byName(name);
    assert.ok(index > 0, `${name} is a release row`);
    assert.ok(!trusted.includes(index), `${name} (row ${index}) must stay off the VPS trust list`);
  }
  assert.equal(vpsSafeRow('node scripts/nope.mjs', ['node', 'scripts/nope.mjs'], source), false);
});

test('a receipt is refused without a known flavor (no GPU) or when its runner checksums differ from the deploy tree', () => {
  for (const bad of [{ flavor: undefined }, { flavor: 'a10g-small' }, { scripts: undefined }, { scripts: { ...sums, 'rows-lib.mjs': 'x'.repeat(64) } }]) {
    assert.deepEqual(trustedFromVps(receipt(bad), tree, commands, source, sums), [], JSON.stringify(bad).slice(0, 60));
  }
  assert.deepEqual(trustedFromVps(receipt(), tree, commands, source), [], 'no own checksums to compare = not trusted');
  assert.ok(trustedFromVps(receipt({ flavor: 'cpu-upgrade' }), tree, commands, source, sums).length > 0);
  // t4-medium (a real GPU) may cover wall-clock rows, never WebKit; the cpu flavors never cover wall rows.
  const cpu: number[] = trustedFromVps(receipt({ flavor: 'cpu-upgrade' }), tree, commands, source, sums);
  const t4: number[] = trustedFromVps(receipt({ flavor: 't4-medium' }), tree, commands, source, sums);
  assert.ok(t4.length > cpu.length && cpu.every(i => t4.includes(i)));
  for (const name of ['double-tap-browser-check', 'next-fight-black-check']) assert.ok(!t4.includes(commands.findIndex((c: string[]) => c.join(' ').includes(name)) + 1), `${name}: WebKit stays on the Mac`);
});

test('N shard receipts for one tree: each row once, a shard of another tree adds nothing', () => {
  const all: number[] = trustedFromVps(receipt(), tree, commands, source, sums);
  const half = (keep: (i: number) => boolean) => receipt({ rows: rows.filter((r: Row) => keep(r.index)).map((r: Row) => ({ ...r, status: 'pass' })) });
  const merged: number[] = trustedFromShards([half(i => i % 2 === 0), half(i => i % 2 === 1), half(() => true)], tree, commands, source, sums);
  assert.deepEqual(merged, all);
  assert.deepEqual(trustedFromShards([receipt({ tree: 'c'.repeat(40) })], tree, commands, source, sums), []);
});

test('the unit-suite receipt needs this tree, zero failures, a known flavor and a matching run-unit.sh checksum', () => {
  const unit = (over = {}) => ({ kind: 'vps-unit-suite', flavor: 'cpu-upgrade', tree, node: 'v24', pass: 2961, fail: 0, exit: 0, scripts: { 'run-unit.sh': 'u'.repeat(64) }, ...over });
  const own = { 'run-unit.sh': 'u'.repeat(64) };
  assert.equal(unitReceiptOk(unit(), tree, own), true);
  for (const bad of [{ tree: 'd'.repeat(40) }, { fail: 1 }, { exit: 1 }, { pass: 0 }, { flavor: 'a10g-small' }, { flavor: undefined }, { scripts: { 'run-unit.sh': 'z'.repeat(64) } }, { kind: 'vps-shadow-rows' }]) {
    assert.equal(unitReceiptOk(unit(bad), tree, own), false, JSON.stringify(bad));
  }
  assert.equal(unitReceiptOk(null, tree, own), false);
  assert.equal(unitReceiptOk(unit(), tree, {}), false);
});

test('deploy.sh takes the unit-suite receipt branch before the CI/Mac gates, and the producers name flavor + checksums', () => {
  const deploy = readFileSync('scripts/deploy.sh', 'utf8');
  assert.ok(deploy.indexOf('vps_unit_receipt_ok') < deploy.indexOf('quality_green "$revision"') + 5000 && deploy.indexOf('vps_unit=') < deploy.indexOf('npm run quality\n'));
  assert.match(readFileSync('scripts/vps-shadow/rows-json.mjs', 'utf8'), /flavor: process\.env\.SHADOW_FLAVOR/);
  assert.match(readFileSync('scripts/vps-shadow/run-unit.sh', 'utf8'), /"run-unit\.sh": c\.createHash/);
});
