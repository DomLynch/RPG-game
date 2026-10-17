// scripts/ci-trusted-checks.mjs (run by deploy.sh to decide which release rows CI already proved) bounds every gh/git call: a hung gh
// used to hold deploy.sh indefinitely (2026-10-16, with the train's own hung fetch/push/poll). It now names the call, trusts nothing it
// could not check (the conservative empty list: every row runs locally) and exits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('a hung gh call is killed at CI_TRUST_CALL_S, named, and nothing is trusted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ci-trust-timeout-')), marker = join(dir, 'finished'), gh = join(dir, 'gh');
  writeFileSync(gh, `#!/bin/sh\nexec '${process.execPath}' -e 'setTimeout(() => require("node:fs").writeFileSync("${marker}", ""), 30000)'\n`); chmodSync(gh, 0o755);
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const r = spawnSync(process.execPath, ['scripts/ci-trusted-checks.mjs', sha], { encoding: 'utf8', env: { ...process.env, CI_TRUST_GH: gh, CI_TRUST_CALL_S: '1' } });
  assert.match(r.stderr, /timed out after 1s/, r.stdout + r.stderr);
  assert.equal(r.stdout.trim(), '', 'no row is trusted when CI could not be read');
  assert.ok(!existsSync(marker), 'the hung gh was killed, not waited out');
});
