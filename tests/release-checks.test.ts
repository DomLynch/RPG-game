import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/release-checks.mjs', import.meta.url));

test('release checks require every command to pass and bind the receipt to HEAD', () => {
  const root = mkdtempSync(join(tmpdir(), 'frankendom-release-gate-'));
  try {
    execFileSync('git', ['init', '-q', root]);
    execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
      'commit', '--allow-empty', '-qm', 'init'], { cwd: root });
    const receipt = join(root, 'artifacts', 'release-checks.json');
    const config = join(root, '.quality-gate.json');
    const pass = [process.execPath, '-e', 'process.exit(0)'];
    writeFileSync(config, JSON.stringify({ release_commands: [pass, pass] }));
    assert.equal(spawnSync(process.execPath, [script, root]).status, 0);
    assert.deepEqual(JSON.parse(readFileSync(receipt, 'utf8')), {
      revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      passed: true, checks: 2,
    });
    writeFileSync(config, JSON.stringify({ release_commands: [pass, [process.execPath, '-e', 'process.exit(7)'], pass] }));
    assert.equal(spawnSync(process.execPath, [script, root]).status, 7);
    assert.throws(() => readFileSync(receipt));
    const marker = join(root, 'ran');
    writeFileSync(config, JSON.stringify({ release_commands: [
      [process.execPath, '-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'yes')`], [],
    ] }));
    assert.notEqual(spawnSync(process.execPath, [script, root]).status, 0);
    assert.equal(existsSync(marker), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
