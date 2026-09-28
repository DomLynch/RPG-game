// scripts/lib/deploy-trust.sh: DEPLOY_TRUST_ROWS trusts named release rows for one run only on a written ruling. Rows without a
// reason stop the deploy; unset leaves the CI-only list and its source byte-identical; set appends the rows and names the ruling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const lib = join(process.cwd(), 'scripts', 'lib', 'deploy-trust.sh');
// Mirrors deploy.sh's release-checks step: CI list in, deploy_trust_apply, then the two values release-checks.mjs receives.
const run = (ci: string, env: Record<string, string>) => {
  const body = `set -euo pipefail\nsource '${lib}'\ntrusted_checks='${ci}'\ntrust_source='CI release-checks for abc'\n` +
    `deploy_trust_apply\nprintf 'SKIP=%s\\nSOURCE=%s\\n' "$trusted_checks" "$trust_source"\n`;
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('DEPLOY_TRUST_')));
  return spawnSync('bash', ['-c', body], { encoding: 'utf8', env: { ...clean, ...env } });
};

test('rows without a reason exit 1 before anything is trusted', () => {
  const r = run('1,2', { DEPLOY_TRUST_ROWS: '47' });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /DEPLOY_TRUST_ROWS needs DEPLOY_TRUST_REASON/);
  assert.ok(!r.stdout.includes('SKIP='));
});

test('unset DEPLOY_TRUST_ROWS leaves the CI-only list and source byte-identical', () => {
  for (const ci of ['', '1,2,3']) {
    const r = run(ci, {});
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, `SKIP=${ci}\nSOURCE=CI release-checks for abc\n`);
  }
  // A reason alone trusts nothing.
  assert.equal(run('1', { DEPLOY_TRUST_REASON: 'stray' }).stdout, 'SKIP=1\nSOURCE=CI release-checks for abc\n');
});

test('ruled rows append to the CI list (or stand alone) and the reason is logged', () => {
  const r = run('1,2', { DEPLOY_TRUST_ROWS: '47', DEPLOY_TRUST_REASON: 'fails the same on live' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, 'Rows 47 trusted by ruling for this run only: fails the same on live\n' +
    'SKIP=1,2,47\nSOURCE=CI release-checks for abc + ruling (rows 47)\n');
  assert.match(run('', { DEPLOY_TRUST_ROWS: '47', DEPLOY_TRUST_REASON: 'r' }).stdout, /^SKIP=47$/m);
});

test('deploy.sh checks the reason right after its EXIT trap and applies the rows at the release-checks step', () => {
  const s = readFileSync(join(process.cwd(), 'scripts', 'deploy.sh'), 'utf8');
  const trap = s.indexOf("trap 'rm -f \"$DEPLOY_LOCK\""), check = s.indexOf('\ndeploy_trust_check');
  assert.ok(trap > 0 && check > trap, 'the fail-fast check runs after the lock-releasing trap');
  assert.match(s, /deploy_trust_apply[^\n]*\nRELEASE_CHECKS_SKIP="\$trusted_checks" RELEASE_CHECKS_SKIP_SOURCE="\$trust_source"/);
});
