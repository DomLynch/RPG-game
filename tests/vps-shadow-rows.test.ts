// scripts/vps-shadow-rows.sh: the Mac-side wrapper starts a shadow run over ssh. SHADOW_CONCURRENCY and SHADOW_CEILING_S must reach the
// VPS runner as RELEASE_CHECK_CONCURRENCY / RELEASE_CHECK_CEILING_S (Lead 2026-09-30: overnight shadows run 1–2 wide with an 1800 s
// ceiling), and the wrapper must connect as the row user, never root. ssh and scp are stubbed on PATH; nothing leaves this machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SHA = '0123456789abcdef0123456789abcdef01234567';

function startRun(env: Record<string, string>): string[] {
  const bin = mkdtempSync(join(tmpdir(), 'shadow-stub-'));
  const log = join(bin, 'calls.log');
  for (const tool of ['ssh', 'scp']) {
    writeFileSync(join(bin, tool), `#!/bin/sh\nprintf '%s\\n' "${tool} $*" >> "${log}"\n`);
    chmodSync(join(bin, tool), 0o755);
  }
  writeFileSync(log, '');
  const r = spawnSync('bash', ['scripts/vps-shadow-rows.sh', SHA], {
    encoding: 'utf8',
    env: { ...process.env, ...env, PATH: `${bin}:${process.env.PATH}` },
  });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  return readFileSync(log, 'utf8').trim().split('\n');
}

test('width and ceiling knobs reach the VPS runner as RELEASE_CHECK_* on the start command', () => {
  const calls = startRun({ SHADOW_CONCURRENCY: '2', SHADOW_CEILING_S: '1800' });
  const start = calls.find((c) => c.includes('run-rows.sh'));
  assert.ok(start, calls.join('\n'));
  assert.match(start, /RELEASE_CHECK_CONCURRENCY=2 RELEASE_CHECK_CEILING_S=1800 nohup nice -n 15 ionice -c3 bash/);
});

test('defaults are the Mac\'s: 4 wide, 600 s ceiling', () => {
  const start = startRun({}).find((c) => c.includes('run-rows.sh'));
  assert.match(start ?? '', /RELEASE_CHECK_CONCURRENCY=4 RELEASE_CHECK_CEILING_S=600 /);
});

test('every ssh and scp call targets the row user, never root', () => {
  const calls = startRun({});
  assert.ok(calls.length >= 3, calls.join('\n'));
  for (const c of calls) {
    assert.match(c, /frankrows@49\.12\.7\.18/, c);
    assert.doesNotMatch(c, /root@|runuser|chown/, c);
  }
});
