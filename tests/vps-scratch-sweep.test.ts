// ops/vps-scratch-sweep --path (Lead 2026-10-13): which paths the named-path mode may remove. sweep_kind() is sourced with SWEEP_SOURCE_ONLY=1, so no lock, log, disk or gh is touched.
// The live tool runs on the VPS (bash 5); the file is parsed by that bash, so this test needs a Linux bash.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const kind = (path: string) => {
  const r = spawnSync('bash', ['-c', 'SWEEP_SOURCE_ONLY=1 source ops/vps-scratch-sweep; sweep_kind "$1"', 'x', path], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};

test('sweep_kind: the lane roots keep the archive-first rule', () => {
  assert.equal(kind('/opt/frankendom-shadow/work/deploy-dl'), 'lane');
  assert.equal(kind('/srv/dev-jobs/cq-pg-1'), 'lane');
  assert.equal(kind('/opt/frankendom-shadow/scratch-retirement-20261013'), 'lane');
});

test('sweep_kind: be-*, hooks-* and cq-* are aged roots, direct children of /var/tmp or /tmp only', () => {
  for (const p of ['/var/tmp/be-eb5eba4c', '/tmp/hooks-review-2546', '/tmp/hooks-ci', '/tmp/cq-2430wt']) assert.equal(kind(p), 'aged', p);
  for (const p of ['/var/tmp/be-eb5eba4c/sub', '/tmp/hooks-x/sub', '/tmp/cq-x/y', '/tmp/be-eb5eba4c', '/var/tmp/hooks-x', '/var/tmp/cq-x']) assert.equal(kind(p), '', `${p} is refused`);
});

test('sweep_kind: the six retired lane homes and the two /tmp one-offs, exactly; the live homes and everything else are refused', () => {
  for (const n of ['char-cd', 'deploy-b', 'char-20b', 'char-boss', 'char-lg', 'combat-b']) assert.equal(kind(`/home/lanes/frankendom-${n}`), 'home', n);
  for (const p of ['/tmp/node-compile-cache', '/tmp/lead-env-tab4']) assert.equal(kind(p), 'tmp', p);
  for (const p of ['/home/lanes/frankendom-backend', '/home/lanes/frankendom-char', '/home/lanes', '/home/lanes/.claude', '/home/lanes/.spill-tools', '/home/lanes/frankendom-char-cd/node_modules',
    '/tmp/lm', '/tmp/claude-1003', '/tmp/rank-job', '/tmp', '/var/tmp', '/root', '/etc', '/', '/opt/frankendom-shadow', '/opt/frankendom-shadow/work', '/srv/dev-jobs'])
    assert.equal(kind(p), '', `${p} is refused`);
});

test('sweep_kind: odd paths are refused', () => {
  for (const p of ['/tmp/hooks-x/../etc', '/var/tmp/be-a b', '/srv/dev-jobs/../../etc', '/tmp/hooks-..']) assert.equal(kind(p), '', p);
});

test('the only roots in the file are the ones sweep_kind lists (a new root has to be added there, with a test)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('ops/vps-scratch-sweep', 'utf8');
  const named = src.slice(src.indexOf('if [ -n "$PATHS" ]; then'), src.indexOf('# work/: lane scratch'));
  assert.ok(!/\/opt\/frankendom-shadow\/work\/\*\|/.test(named) && /sweep_kind "\$p"/.test(named), 'the named-path loop decides through sweep_kind, not a second inline list');
});
