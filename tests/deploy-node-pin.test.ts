// The Mac unit step runs under the pinned node or not at all (Lead 2026-10-13: the Mac's default node was v25.8.1, every trusted receipt ran NODE_PIN
// v22.23.3). scripts/lib/node-pin.sh against stub `node` binaries that report a chosen version, and deploy.sh's wiring: every branch that runs a suite
// calls `use_pinned_node || exit 1` before it.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { NODE_PIN } from '../scripts/lib/vps-unit.mjs';

const real = process.execPath;
// A stub node: `-v` prints the given version, anything else (the NODE_PIN read) runs the real node.
const stub = (dir: string, version: string) => {
  mkdirSync(join(dir, 'bin'), { recursive: true });
  writeFileSync(join(dir, 'bin', 'node'), `#!/bin/bash\nif [[ "$1" == -v ]]; then echo ${version}; else exec ${JSON.stringify(real)} "$@"; fi\n`);
  chmodSync(join(dir, 'bin', 'node'), 0o755);
  return join(dir, 'bin');
};
const run = (pathNode: string, pinDir: string) => spawnSync('bash', ['-c', 'source scripts/lib/node-pin.sh; use_pinned_node; s=$?; echo "node=$(command -v node) v=$(node -v)"; exit $s'], {
  encoding: 'utf8', env: { ...process.env, PATH: `${pathNode}:/usr/bin:/bin`, DEPLOY_NODE_PIN_DIR: pinDir },
});

test('use_pinned_node: PATH already the pin -> runs as is; the Mac default (v25.8.1) with a pinned install -> that install first on PATH', () => {
  const base = mkdtempSync(join(tmpdir(), 'node-pin-'));
  try {
    const same = run(stub(join(base, 'same'), NODE_PIN.version), join(base, 'absent'));
    assert.equal(same.status, 0, same.stdout + same.stderr);
    assert.match(same.stdout, new RegExp(`unit node: ${NODE_PIN.version} \\(PATH\\)`));
    const pinned = stub(join(base, 'pin'), NODE_PIN.version);
    const mac = run(stub(join(base, 'mac'), 'v25.8.1'), join(base, 'pin'));
    assert.equal(mac.status, 0, mac.stdout + mac.stderr);
    assert.match(mac.stdout, /PATH had v25\.8\.1/);
    assert.match(mac.stdout, new RegExp(`node=${pinned}/node v=${NODE_PIN.version.replace(/\./g, '\\.')}`), 'the pinned node is the one the suite gets');
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('use_pinned_node: another node and no pinned install (or one that is not the pin) -> stops with both versions and the install commands', () => {
  const base = mkdtempSync(join(tmpdir(), 'node-pin-'));
  try {
    const none = run(stub(join(base, 'mac'), 'v25.8.1'), join(base, 'absent'));
    assert.equal(none.status, 1);
    assert.match(none.stdout, new RegExp(`needs node ${NODE_PIN.version.replace(/\./g, '\\.')}.*PATH has v25\\.8\\.1`));
    assert.match(none.stdout, /Not running it under another node/);
    assert.match(none.stdout, new RegExp(`nodejs\\.org/dist/${NODE_PIN.version.replace(/\./g, '\\.')}/.*SHASUMS256\\.txt.*shasum -a 256 -c`), 'the install line checks the official hash');
    stub(join(base, 'wrong'), 'v22.0.0');
    const wrong = run(stub(join(base, 'mac2'), 'v25.8.1'), join(base, 'wrong'));
    assert.equal(wrong.status, 1, 'a pinned dir whose node is not the pin is refused');
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('deploy.sh: every branch that runs a unit suite on the Mac calls `use_pinned_node || exit 1` before it; build-only branches do not need it', () => {
  const lines = readFileSync('scripts/deploy.sh', 'utf8').split('\n');
  assert.ok(lines.some((l) => /^source scripts\/lib\/node-pin\.sh/.test(l)), 'deploy.sh sources node-pin.sh');
  const suite = /^\s*npm (test|run (test:all|test:bot|quality|quality:deploy|typecheck:tests))\b/;
  const branch = /^\s*(if|elif|else)\b/;
  const runs = lines.map((l, i) => [l, i] as const).filter(([l]) => suite.test(l));
  assert.ok(runs.length >= 4, `the suite lines are found (${runs.length})`);
  for (const [l, i] of runs) {
    let j = i - 1, guarded = false;
    for (; j >= 0 && !branch.test(lines[j]!); j--) if (/^\s*use_pinned_node \|\| exit 1\b/.test(lines[j]!)) guarded = true;
    assert.ok(guarded, `deploy.sh:${i + 1} "${l.trim()}" runs a suite with no use_pinned_node earlier in its branch (from line ${j + 1})`);
  }
});
