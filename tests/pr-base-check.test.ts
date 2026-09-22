// scripts/pr-base-check.mjs: base = trunk passes; base still in flight passes with a note; base already landed on trunk fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts', 'pr-base-check.mjs');
const g = (cwd: string, ...a: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
test('base branch states', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pr-base-')), origin = join(dir, 'o.git'), work = join(dir, 'w');
  execFileSync('git', ['init', '-q', '--bare', origin]); execFileSync('git', ['clone', '-q', origin, work]);
  g(work, 'checkout', '-q', '-b', 'trunk'); writeFileSync(join(work, 'a'), '1'); g(work, 'add', '.'); g(work, 'commit', '-qm', 'init');
  g(work, 'checkout', '-q', '-b', 'flight'); writeFileSync(join(work, 'b'), '1'); g(work, 'add', '.'); g(work, 'commit', '-qm', 'in flight');
  g(work, 'checkout', '-q', '-b', 'landed', 'trunk'); writeFileSync(join(work, 'c'), '1'); g(work, 'add', '.'); g(work, 'commit', '-qm', 'landed work');
  g(work, 'checkout', '-q', 'trunk'); g(work, 'merge', '-q', '--no-ff', '-m', 'merge landed', 'landed'); g(work, 'push', '-q', '--all', 'origin');
  const run = (base: string) => spawnSync(process.execPath, [script, base], { cwd: work, encoding: 'utf8', env: { ...process.env, TRUNK_BRANCH: 'trunk' } });
  const trunk = run('trunk'); assert.equal(trunk.status, 0, trunk.stdout + trunk.stderr);
  const flight = run('flight'); assert.equal(flight.status, 0, flight.stdout + flight.stderr); assert.match(flight.stdout, /stacked on flight, which is still in flight/);
  const landed = run('landed'); assert.equal(landed.status, 1, landed.stdout + landed.stderr); assert.match(landed.stderr, /base branch landed has already landed on trunk/);
  assert.equal(run('nowhere').status, 1);
});
