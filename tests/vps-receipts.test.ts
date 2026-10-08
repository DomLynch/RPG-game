import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { trustedFromVps, vpsSafeRow } from '../scripts/lib/vps-receipts.mjs';
import { rowSet } from '../scripts/vps-shadow/rows-lib.mjs';

const commands: string[][] = JSON.parse(readFileSync('.quality-gate.json', 'utf8')).release_commands;
const source = (script: string) => { try { return readFileSync(script, 'utf8'); } catch { return null; } };
const tree = 'a'.repeat(40);
type Row = { index: number; command: string; timing?: string };
const rows: Row[] = rowSet(commands, source);
const receipt = (over = {}) => ({ kind: 'vps-shadow-rows', tree, buildStatus: 0, dirty: 0, rows: rows.map((r: Row) => ({ ...r, status: 'pass' })), ...over });

test('a VPS pass for the deployed tree is trusted for virtual-clock and no-browser rows only: never WebKit, never wall-clock', () => {
  const trusted: number[] = trustedFromVps(receipt(), tree, commands, source);
  assert.ok(trusted.length > 0 && trusted.length < commands.length);
  // Stricter than the per-file label: the imports are read too, so a trusted row is never a wall or WebKit row by the plain label either.
  for (const row of rows) {
    const wallOrWebKit = row.timing === 'wall' || /--engine\s+webkit\b/.test(row.command);
    if (wallOrWebKit) assert.ok(!trusted.includes(row.index), `row ${row.index}`);
  }
});

test('nothing is trusted for another tree, a failed or dirty build, a failed row, or a row whose command changed', () => {
  assert.deepEqual(trustedFromVps(receipt(), 'b'.repeat(40), commands, source), []);
  assert.deepEqual(trustedFromVps(receipt(), 'short', commands, source), []);
  assert.deepEqual(trustedFromVps(receipt({ buildStatus: 1 }), tree, commands, source), []);
  assert.deepEqual(trustedFromVps(receipt({ dirty: 2 }), tree, commands, source), []);
  assert.deepEqual(trustedFromVps(null, tree, commands, source), []);
  const base: number[] = trustedFromVps(receipt(), tree, commands, source);
  const failed = receipt({ rows: rows.map((r: Row) => ({ ...r, status: r.index === base[0] ? 'fail' : 'pass', exit: r.index === base[0] ? 1 : undefined })) });
  assert.ok(!trustedFromVps(failed, tree, commands, source).includes(base[0]));
  const edited = receipt({ rows: rows.map((r: Row) => ({ ...r, status: 'pass', command: r.index === base[0] ? `${r.command} --x` : r.command })) });
  assert.ok(!trustedFromVps(edited, tree, commands, source).includes(base[0]));
});

test('deploy.sh applies the VPS receipts before the Mac rows, opt-in', () => {
  const deploy = readFileSync('scripts/deploy.sh', 'utf8');
  assert.ok(deploy.indexOf('vps_receipts_apply') < deploy.indexOf('node scripts/release-checks.mjs'));
  assert.match(readFileSync('scripts/lib/deploy-vps.sh', 'utf8'), /DEPLOY_VPS_RECEIPTS:-\}" == on/);
});

test('rows 2, 44, 45 and 52 (browser launched through an import, or webkit.launch + clock.resume) are not trusted; a missing script is not trusted', () => {
  const byName = (name: string) => commands.findIndex(c => c.join(' ').includes(name)) + 1;
  const trusted: number[] = trustedFromVps(receipt(), tree, commands, source);
  for (const name of ['roster-browser-check', 'double-tap-browser-check', 'sparring-browser-check', 'next-fight-black-check']) {
    const index = byName(name);
    assert.ok(index > 0, `${name} is a release row`);
    assert.ok(!trusted.includes(index), `${name} (row ${index}) must stay off the VPS trust list`);
  }
  assert.equal(vpsSafeRow('node scripts/nope.mjs', ['node', 'scripts/nope.mjs'], source), false);
});

test('vps-receipt-trust.mjs trusts nothing when git cannot resolve the sha (non-zero status), and prints no rows', () => {
  const r = spawnSync('node', ['scripts/vps-receipt-trust.mjs', 'no-such-ref-zzzz'], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /trusting nothing/);
});
