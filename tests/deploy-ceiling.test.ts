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
// "Killed, not waited out" is asserted by ORDER, not by a wall clock: under load 50-60 inside deploy.sh's quality gate a 1 s ceiling
// took 18.6 s end to end (Run 3a), so any fixed bound is a flake. The wedged child is ONE process that writes a marker at the end of its
// 30 s and only then exits — it holds the stdout pipe, so spawnSync cannot return before it either dies or writes. Marker absent on
// return = it was killed. It runs under an `sh` the way a real step's node runs under npm: a watchdog that killed only the direct
// child would end the step (no 'never', exit 124) and leave the grandchild holding the pipe — that is the case the marker catches.
// A kill that missed it makes the test slow (30 s) and red, never green.
test('a wedged step is killed at the ceiling, named, and the lock is still released', () => {
  const marker = join(mkdtempSync(join(tmpdir(), 'deploy-ceiling-child-')), 'finished');
  const child = `sh -c "'${process.execPath}' -e 'setTimeout(() => require(\\"node:fs\\").writeFileSync(\\"${marker}\\", \\"\\"), 30_000)'; exit"`;
  const f = fake(`deploy_step "quality gate"\n${child}\necho never`);
  const r = f.run({ DEPLOY_CEILING_S: '1' });
  assert.equal(r.status, 124, r.stdout + r.stderr);
  assert.match(r.stderr, /Deploy ceiling: no exit after 1s in step 'quality gate'/);
  assert.ok(!r.stdout.includes('never'));
  assert.ok(!existsSync(marker), 'the wedged child was killed, not waited out');
  assert.ok(!existsSync(f.lock), 'EXIT trap released the lock');
});
test('a deploy that finishes in time is untouched', () => {
  const f = fake('deploy_step "fast"\necho done');
  const r = f.run({ DEPLOY_CEILING_S: '30' });
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /== fast at \d\d:\d\d:\d\d \(load [\d.]+\)\ndone/); assert.ok(!existsSync(f.lock));
});
