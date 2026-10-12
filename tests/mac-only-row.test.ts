// scripts/mac-only-row.mjs: no browser rows in a VPS lane's Stop gate (Lead 2026-10-12, Deploy B trapped ~2 h). On a VPS lane the wrapped row is not run
// and says so; anywhere else it runs as is with its own exit code. Every browser row in completion_commands is wrapped and still runs as a release row.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const wrap = (marker: string, ...argv: string[]) => spawnSync(process.execPath, ['scripts/mac-only-row.mjs', ...argv], { encoding: 'utf8', env: { ...process.env, MAC_ONLY_ROW_MARKER: marker } });

test('on a VPS lane the row is not run (and says so); off the VPS it runs with its own exit code and output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'macrow-'));
  try {
    const probe = join(dir, 'ran');
    const vps = wrap(dir, process.execPath, '-e', `require('fs').writeFileSync(${JSON.stringify(probe)}, '1'); process.exit(3)`);
    assert.equal(vps.status, 0);
    assert.match(vps.stdout, /mac-only-row: not run on this VPS lane: .* it runs as a release row and in Mac lanes/);
    assert.throws(() => readFileSync(probe), 'the row never started on the VPS');
    const mac = wrap(join(dir, 'absent'), process.execPath, '-e', 'console.log("row output"); process.exit(3)');
    assert.equal(mac.status, 3, 'a red row stays red off the VPS');
    assert.match(mac.stdout, /row output/);
    assert.equal(wrap(join(dir, 'absent')).status, 2, 'usage');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('.quality-gate.json: every browser row in completion_commands is wrapped, and each still runs as a release row', () => {
  const gate = JSON.parse(readFileSync('.quality-gate.json', 'utf8'));
  const browser = (c: string[]) => c.some((a) => /browser|playwright|chromium|webkit/i.test(a));
  const rows = (gate.completion_commands as string[][]).filter(browser);
  assert.ok(rows.length >= 1);
  for (const row of rows) {
    assert.deepEqual(row.slice(0, 2), ['node', 'scripts/mac-only-row.mjs'], `${row.join(' ')} is not wrapped`);
    const script = row.find((a) => a.endsWith('.mjs') && a !== 'scripts/mac-only-row.mjs');
    assert.ok((gate.release_commands as string[][]).some((c) => c.includes(script!)), `${script} must still run as a release row`);
  }
});
