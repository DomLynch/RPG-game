// scripts/lib/deploy-ceiling.sh: a deploy that wedges is killed at the ceiling with the step named, exit 124, and the EXIT trap still
// runs (the lock is released); a deploy that finishes in time is untouched and leaves no watchdog behind.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const lib = join(process.cwd(), 'scripts', 'lib', 'deploy-ceiling.sh');
const fake = (body: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-ceiling-')), lock = join(dir, 'lock'), script = join(dir, 'deploy.sh');
  writeFileSync(lock, 'x');
  writeFileSync(script, `#!/usr/bin/env bash\nset -euo pipefail\nsource '${lib}'\ntrap 'rm -f "${lock}"; deploy_ceiling_off' EXIT\n${body}\n`);
  return { lock, run: (env: Record<string, string>) => spawnSync('bash', [script], { encoding: 'utf8', env: { ...process.env, ...env } }) };
};
test('a wedged step is killed at the ceiling, named, and the lock is still released', () => {
  const f = fake('deploy_step "quality gate"\nsleep 30\necho never');
  const t0 = Date.now(), r = f.run({ DEPLOY_CEILING_S: '1' });
  assert.equal(r.status, 124, r.stdout + r.stderr);
  assert.match(r.stderr, /Deploy ceiling: no exit after 1s in step 'quality gate'/);
  assert.ok(!r.stdout.includes('never'));
  assert.ok(Date.now() - t0 < 10_000, 'killed promptly, not after the 30 s child');
  assert.ok(!existsSync(f.lock), 'EXIT trap released the lock');
});
test('a deploy that finishes in time is untouched', () => {
  const f = fake('deploy_step "fast"\necho done');
  const r = f.run({ DEPLOY_CEILING_S: '30' });
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /== fast\ndone/); assert.ok(!existsSync(f.lock));
});
