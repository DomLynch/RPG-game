import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { trustedFromVps } from '../scripts/lib/vps-receipts.mjs';
import { rowSet } from '../scripts/vps-shadow/rows-lib.mjs';

const commands: string[][] = JSON.parse(readFileSync('.quality-gate.json', 'utf8')).release_commands;
const source = (script: string) => { try { return readFileSync(script, 'utf8'); } catch { return ''; } };
const tree = 'a'.repeat(40);
const rows = rowSet(commands, source);
const receipt = (over = {}) => ({ kind: 'vps-shadow-rows', tree, buildStatus: 0, dirty: 0, rows: rows.map(r => ({ ...r, status: 'pass' })), ...over });

test('a VPS pass for the deployed tree is trusted for virtual-clock and no-browser rows only: never WebKit, never wall-clock', () => {
  const trusted: number[] = trustedFromVps(receipt(), tree, commands, source);
  assert.ok(trusted.length > 0 && trusted.length < commands.length);
  for (const row of rows) {
    const wallOrWebKit = row.timing === 'wall' || /--engine\s+webkit\b/.test(row.command);
    assert.equal(trusted.includes(row.index), !wallOrWebKit, `row ${row.index}`);
  }
});

test('nothing is trusted for another tree, a failed or dirty build, a failed row, or a row whose command changed', () => {
  assert.deepEqual(trustedFromVps(receipt(), 'b'.repeat(40), commands, source), []);
  assert.deepEqual(trustedFromVps(receipt(), 'short', commands, source), []);
  assert.deepEqual(trustedFromVps(receipt({ buildStatus: 1 }), tree, commands, source), []);
  assert.deepEqual(trustedFromVps(receipt({ dirty: 2 }), tree, commands, source), []);
  assert.deepEqual(trustedFromVps(null, tree, commands, source), []);
  const base: number[] = trustedFromVps(receipt(), tree, commands, source);
  const failed = receipt({ rows: rows.map(r => ({ ...r, status: r.index === base[0] ? 'fail' : 'pass', exit: r.index === base[0] ? 1 : undefined })) });
  assert.ok(!trustedFromVps(failed, tree, commands, source).includes(base[0]));
  const edited = receipt({ rows: rows.map(r => ({ ...r, status: 'pass', command: r.index === base[0] ? `${r.command} --x` : r.command })) });
  assert.ok(!trustedFromVps(edited, tree, commands, source).includes(base[0]));
});

test('deploy.sh applies the VPS receipts before the Mac rows, opt-in', () => {
  const deploy = readFileSync('scripts/deploy.sh', 'utf8');
  assert.ok(deploy.indexOf('vps_receipts_apply') < deploy.indexOf('node scripts/release-checks.mjs'));
  assert.match(readFileSync('scripts/lib/deploy-vps.sh', 'utf8'), /DEPLOY_VPS_RECEIPTS:-\}" == on/);
});
