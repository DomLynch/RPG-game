// deploy.sh's quality_green: the CI-green gate must find the run that proved the tree even when a newer, unfinished run exists for the same sha
// (release V: the fast-forward push started a queued push run that sorted first; the green pull_request run was second, and the Mac ran its own suite).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const deploy = readFileSync('scripts/deploy.sh', 'utf8');
const fn = deploy.slice(deploy.indexOf('quality_green() {'), deploy.indexOf('\n}\n', deploy.indexOf('quality_green() {')) + 3);
const run = (runs: Record<string, string>, list: string[]) => {
  const dir = mkdtempSync(join(tmpdir(), 'qgreen-'));
  try {
    mkdirSync(join(dir, 'bin'));
    const gh = `#!/bin/sh\nif [ "$2" = list ]; then printf '%s\\n' ${list.map((l) => `'${l}'`).join(' ')}; exit 0; fi\ncase "$3" in ${Object.entries(runs).map(([id, v]) => `${id}) echo ${v};;`).join(' ')} esac\n`;
    writeFileSync(join(dir, 'bin/gh'), gh); chmodSync(join(dir, 'bin/gh'), 0o755);
    const r = spawnSync('bash', ['-c', `${fn}\nquality_green deadbeef`], { encoding: 'utf8', timeout: 20_000, env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}` } });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('a green run is found even when a newer unfinished run for the same sha sorts first', () => {
  assert.equal(run({ 111: 'no', 222: 'yes' }, ['111 https://x/runs/111', '222 https://x/runs/222']), 'https://x/runs/222');
});
test('no green run (or no run, or gh failing) prints nothing and still exits 0', () => {
  assert.equal(run({ 111: 'no', 222: 'no' }, ['111 https://x/runs/111', '222 https://x/runs/222']), '');
  assert.equal(run({}, []), '');
});
test('the first green run wins when several are green', () => {
  assert.equal(run({ 111: 'yes', 222: 'yes' }, ['111 https://x/runs/111', '222 https://x/runs/222']), 'https://x/runs/111');
});
